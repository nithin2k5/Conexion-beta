/**
 * Conexion — Express + WebSocket Matchmaking Server
 *
 * HTTP  → Express app  (port 3001)
 * WS    → ws.Server attached to the same HTTP server via the "upgrade" event
 *
 * REST endpoints:
 *   GET  /health          — liveness probe
 *   GET  /api/stats       — live queue & session stats
 *
 * WebSocket protocol (all messages are JSON strings):
 *
 * CLIENT → SERVER:
 *   { type: "queue",   interests: string[] }   — join matchmaking queue
 *   { type: "cancel" }                          — leave queue
 *   { type: "message", text: string }           — send chat message to partner
 *   { type: "skip" }                            — skip partner & re-queue
 *   { type: "end" }                             — end session cleanly
 *   { type: "ping" }                            — keep-alive
 *
 * SERVER → CLIENT:
 *   { type: "queued",       position: number, online: number }
 *   { type: "matched",      sharedInterests: string[], sessionId: string }
 *   { type: "message",      text: string, ts: number }
 *   { type: "partner_left" }
 *   { type: "online_count", count: number }
 *   { type: "pong" }
 */

"use strict";

const http    = require("http");
const express = require("express");
const cors    = require("cors");
const { WebSocketServer, WebSocket } = require("ws");
const { randomUUID } = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────

const PORT   = process.env.PORT    || 3001;
const ORIGIN = process.env.ORIGIN  || "http://localhost:3000";
const MAX_PAYLOAD = 65536; // 64KB max websocket payload
const RATE_LIMIT_MSGS = 20; // max messages per second

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

app.use(cors({ origin: ORIGIN }));
app.use(express.json());

// ── REST routes ───────────────────────────────────────────────────────────────

/** Liveness probe — used by Docker / load-balancers */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** Live stats */
app.get("/api/stats", (_req, res) => {
  const activeSessions = new Set(
    [...clients.values()]
      .filter((c) => c.sessionId !== null)
      .map((c) => c.sessionId)
  ).size;

  res.json({
    online:         clients.size,
    queued:         queue.length,
    activeSessions,
    timestamp:      new Date().toISOString(),
  });
});

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(app);

// ── WebSocket server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

/**
 * Upgrade HTTP → WS only on the /ws path.
 * Any other upgrade request gets destroyed.
 */
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    const reqOrigin = req.headers.origin;
    // Check if origin matches allowed ORIGIN
    if (ORIGIN !== "*" && reqOrigin && !reqOrigin.startsWith(ORIGIN)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ── In-memory state ───────────────────────────────────────────────────────────

/** @type {Map<string, { ws: WebSocket, interests: string[], partnerId: string|null, sessionId: string|null, msgCount: number, windowStart: number }>} */
const clients = new Map();

/** Ordered list of client IDs waiting to be matched */
const queue = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload) {
  for (const { ws } of clients.values()) {
    send(ws, payload);
  }
}

function removeFromQueue(id) {
  const idx = queue.indexOf(id);
  if (idx !== -1) queue.splice(idx, 1);
}

/**
 * Score how well two clients' interests overlap.
 * Higher = better match. Both having no interests → score 0 (wildcard).
 */
function matchScore(a, b) {
  if (a.interests.length === 0 && b.interests.length === 0) return 0;
  const setA = new Set(a.interests);
  return b.interests.filter((i) => setA.has(i)).length;
}

/**
 * Pair the new client with the best candidate from the queue.
 * Falls back to pushing the client onto the queue if no one is waiting.
 */
function tryMatch(newId) {
  const newClient = clients.get(newId);
  if (!newClient) return;

  if (queue.length === 0) {
    queue.push(newId);
    send(newClient.ws, {
      type:     "queued",
      position: queue.length,
      online:   clients.size,
    });
    return;
  }

  // Pick the highest-scoring candidate
  let bestIdx   = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < queue.length; i++) {
    const candidateId = queue[i];
    if (candidateId === newId) continue;
    const candidate = clients.get(candidateId);
    if (!candidate) continue;

    const score = matchScore(newClient, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestIdx   = i;
    }
  }

  if (bestIdx === -1) {
    queue.push(newId);
    send(newClient.ws, {
      type:     "queued",
      position: queue.length,
      online:   clients.size,
    });
    return;
  }

  const partnerId    = queue.splice(bestIdx, 1)[0];
  const partnerClient = clients.get(partnerId);

  if (!partnerClient) {
    // Partner disconnected mid-queue — retry
    return tryMatch(newId);
  }

  // Link the pair
  const sessionId = randomUUID();
  newClient.partnerId      = partnerId;
  newClient.sessionId      = sessionId;
  partnerClient.partnerId  = newId;
  partnerClient.sessionId  = sessionId;

  const setA             = new Set(newClient.interests);
  const sharedInterests  = partnerClient.interests.filter((i) => setA.has(i));

  send(newClient.ws,    { type: "matched", sharedInterests, sessionId, role: "caller" });
  send(partnerClient.ws, { type: "matched", sharedInterests, sessionId, role: "callee" });

  console.log(
    `[match] ${newId.slice(0, 6)} ↔ ${partnerId.slice(0, 6)}` +
    ` | shared: [${sharedInterests.join(", ")}]`
  );
}

/** Cleanly detach a client from their partner and notify the partner. */
function detachPartner(clientId) {
  const client = clients.get(clientId);
  if (!client?.partnerId) return;

  const partner = clients.get(client.partnerId);
  if (partner) {
    partner.partnerId = null;
    partner.sessionId = null;
    send(partner.ws, { type: "partner_left" });
  }

  client.partnerId = null;
  client.sessionId = null;
}

// ── WebSocket connection handler ──────────────────────────────────────────────

wss.on("connection", (ws) => {
  const id = randomUUID();
  clients.set(id, { ws, interests: [], partnerId: null, sessionId: null, msgCount: 0, windowStart: Date.now() });

  broadcast({ type: "online_count", count: clients.size });
  console.log(`[+] ${id.slice(0, 6)} connected  | total: ${clients.size}`);

  ws.on("message", (raw) => {
    const client = clients.get(id);
    if (!client) return;

    // Rate Limiting
    const now = Date.now();
    if (now - client.windowStart > 1000) {
      client.msgCount = 0;
      client.windowStart = now;
    }
    client.msgCount++;
    if (client.msgCount > RATE_LIMIT_MSGS) {
      return; // Drop message due to rate limit
    }

    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {

      case "ping":
        send(ws, { type: "pong" });
        break;

      case "queue":
        detachPartner(id);
        removeFromQueue(id);
        client.interests = Array.isArray(msg.interests) 
          ? msg.interests.filter(i => typeof i === "string").map(i => i.substring(0, 50)) 
          : [];
        tryMatch(id);
        break;

      case "cancel":
        detachPartner(id);
        removeFromQueue(id);
        client.partnerId = null;
        client.sessionId = null;
        break;

      case "message":
        if (!client.partnerId || typeof msg.text !== "string") break;
        const safeText = msg.text.trim();
        if (!safeText || safeText.length > 2000) break;
        {
          const partner = clients.get(client.partnerId);
          if (partner) send(partner.ws, { type: "message", text: safeText, ts: Date.now() });
        }
        break;

      case "rtc_signal":
        if (!client.partnerId || !msg.payload) break;
        if (JSON.stringify(msg.payload).length > 10000) break; // sanity check payload size
        {
          const partner = clients.get(client.partnerId);
          if (partner) send(partner.ws, { type: "rtc_signal", payload: msg.payload });
        }
        break;

      case "skip":
        detachPartner(id);
        removeFromQueue(id);
        tryMatch(id);
        break;

      case "end":
        detachPartner(id);
        removeFromQueue(id);
        break;
    }
  });

  ws.on("close", () => {
    detachPartner(id);
    removeFromQueue(id);
    clients.delete(id);
    broadcast({ type: "online_count", count: clients.size });
    console.log(`[-] ${id.slice(0, 6)} disconnected | total: ${clients.size}`);
  });

  ws.on("error", (err) => {
    console.error(`[err] ${id.slice(0, 6)}:`, err.message);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`✅  Conexion server listening on port ${PORT}`);
  console.log(`    HTTP  → http://localhost:${PORT}`);
  console.log(`    WS    → ws://localhost:${PORT}/ws`);
  console.log(`    CORS  → ${ORIGIN}`);
});
