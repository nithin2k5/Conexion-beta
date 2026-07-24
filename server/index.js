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
const rateLimit = require("express-rate-limit");

// ── Config ────────────────────────────────────────────────────────────────────

const PORT   = process.env.PORT    || 3001;
const ORIGIN = process.env.ORIGIN  || "http://localhost:3000";
const MAX_PAYLOAD = 65536; // 64KB max websocket payload
const RATE_LIMIT_MSGS = 20; // max messages per second
const MAX_TOTAL_CLIENTS = 500; // max concurrent clients


// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 60 })); // 60 req/min per IP

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

/** ICE / TURN credentials — consumed by the client before WebRTC setup */
app.get("/api/turn-credentials", (req, res) => {
  // Fix 1: Require request to originate from the allowed frontend origin
  const reqOrigin = req.headers.origin || req.headers.referer || "";
  if (!reqOrigin.startsWith(ORIGIN)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];

  // If TURN credentials are configured, add them
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    const turnUrls = process.env.TURN_URL.split(",").map(u => u.trim());
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers });
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
    if (clients.size >= MAX_TOTAL_CLIENTS) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }

    const reqOrigin = req.headers.origin;

    // Fix 2: Block connections with no origin header AND wrong origins
    if (!reqOrigin || (ORIGIN !== "*" && !reqOrigin.startsWith(ORIGIN))) {
      console.log("[reject] origin mismatch:", reqOrigin, "expected:", ORIGIN);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Fix 3: Enforce per-IP connection limit
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
    const currentConns = ipConnections.get(ip) || 0;
    if (currentConns >= MAX_CONNS_PER_IP) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      console.warn(`[rate] IP ${ip} exceeded connection limit (${MAX_CONNS_PER_IP})`);
      return;
    }
    ipConnections.set(ip, currentConns + 1);

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws._remoteIP = ip; // stash IP for cleanup in the close handler
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ── In-memory state ───────────────────────────────────────────────────────────

/** @type {Map<string, { ws: WebSocket, name: string, interests: string[], partnerId: string|null, sessionId: string|null, msgCount: number, windowStart: number, previousPartners: Set<string>, inGlobalChat: boolean }>} */
const clients = new Map();

// Fix 3: Track active WebSocket connections per IP to prevent flood/DoS
const MAX_CONNS_PER_IP = 10;
const ipConnections = new Map(); // ip → connection count

/** Ordered list of client IDs waiting to be matched */
const queue = [];

/** Global chat history (last 50 messages) */
const globalChatHistory = [];

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

function broadcastGlobalUsers() {
  const users = [];
  for (const [id, c] of clients.entries()) {
    if (c.inGlobalChat) {
      users.push({ id, name: c.name });
    }
  }
  const payload = { type: "global_users", users };
  for (const c of clients.values()) {
    if (c.inGlobalChat) send(c.ws, payload);
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

    // Skip previously matched partners to avoid re-pairing
    if (newClient.previousPartners.has(candidateId) || candidate.previousPartners.has(newId)) continue;

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

  // Record each other as previous partners so they won't be re-matched
  newClient.previousPartners.add(partnerId);
  partnerClient.previousPartners.add(newId);

  const setA             = new Set(newClient.interests);
  const sharedInterests  = partnerClient.interests.filter((i) => setA.has(i));

  send(newClient.ws,     { type: "matched", sharedInterests, sessionId, role: "caller", partnerName: partnerClient.name });
  send(partnerClient.ws, { type: "matched", sharedInterests, sessionId, role: "callee", partnerName: newClient.name });

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
  clients.set(id, { ws, name: "Anonymous", interests: [], partnerId: null, sessionId: null, msgCount: 0, windowStart: Date.now(), previousPartners: new Set(), inGlobalChat: false });

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
        // Save display name (sanitised, max 30 chars, fallback to Anonymous)
        client.name = typeof msg.name === "string" && msg.name.trim()
          ? msg.name.trim().substring(0, 30)
          : "Anonymous";
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
        // Server-side hate speech filter
        const hateSpeechRegex = /\b(nigger|faggot|spic|chink|porn|sex|tits|dick|pussy|cock|boobs|cunt|slut|whore)\b/i;
        if (hateSpeechRegex.test(safeText)) break;
        {
          // Relay optional reply-quote context (sanitised, max 200 chars)
          const replyQuote = typeof msg.replyTo?.text === "string"
            ? msg.replyTo.text.trim().substring(0, 200)
            : undefined;
          const partner = clients.get(client.partnerId);
          if (partner) send(partner.ws, {
            type: "message",
            text: safeText,
            ts: Date.now(),
            ...(replyQuote ? { replyTo: { text: replyQuote } } : {}),
          });
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

      case "report": {
        const reason = typeof msg.reason === "string" ? msg.reason.substring(0, 200) : "Unknown";
        console.log(
          `[report] from=${id.slice(0, 6)} session=${client.sessionId || "none"} ` +
          `partner=${client.partnerId ? client.partnerId.slice(0, 6) : "none"} ` +
          `reason="${reason}" ts=${new Date().toISOString()}`
        );
        // Auto-skip after reporting
        detachPartner(id);
        removeFromQueue(id);
        tryMatch(id);
        break;
      }

      case "typing":
        if (!client.partnerId) break;
        {
          const partner = clients.get(client.partnerId);
          if (partner) send(partner.ws, { type: "typing", isTyping: !!msg.isTyping });
        }
        break;

      case "read":
        if (!client.partnerId || !msg.messageId) break;
        {
          const partner = clients.get(client.partnerId);
          if (partner) send(partner.ws, { type: "read", messageId: msg.messageId });
        }
        break;

      case "end":
        detachPartner(id);
        removeFromQueue(id);
        break;

      case "join_global":
        client.inGlobalChat = true;
        if (msg.name && typeof msg.name === "string") {
          client.name = msg.name.trim().substring(0, 30) || "Anonymous";
        }
        send(ws, { type: "global_history", messages: globalChatHistory });
        broadcastGlobalUsers();
        break;

      case "leave_global":
        client.inGlobalChat = false;
        broadcastGlobalUsers();
        break;

      case "global_message":
        if (!client.inGlobalChat || typeof msg.text !== "string") break;
        const safeGlobalText = msg.text.trim();
        if (!safeGlobalText || safeGlobalText.length > 2000) break;
        
        const globalHateSpeechRegex = /\b(nigger|faggot|spic|chink|porn|sex|tits|dick|pussy|cock|boobs|cunt|slut|whore)\b/i;
        if (globalHateSpeechRegex.test(safeGlobalText)) break;

        const globalMsg = {
          id: randomUUID(),
          name: client.name,
          text: safeGlobalText,
          ts: Date.now()
        };

        globalChatHistory.push(globalMsg);
        if (globalChatHistory.length > 50) globalChatHistory.shift();

        const globalPayload = { type: "global_message", message: globalMsg };
        for (const [clientId, c] of clients.entries()) {
          if (c.inGlobalChat) {
            send(c.ws, globalPayload);
          }
        }
        break;
    }
  });

  ws.on("close", () => {
    const wasInGlobal = client.inGlobalChat;
    detachPartner(id);
    removeFromQueue(id);
    clients.delete(id);
    if (wasInGlobal) broadcastGlobalUsers();

    // Fix 3: Decrement per-IP connection count on disconnect
    const ip = ws._remoteIP;
    if (ip) {
      const n = ipConnections.get(ip) || 0;
      if (n <= 1) ipConnections.delete(ip);
      else ipConnections.set(ip, n - 1);
    }

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
