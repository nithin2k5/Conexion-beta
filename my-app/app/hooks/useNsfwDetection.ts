"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * NSFW Detection — nsfwjs only.
 *
 * We intentionally removed MobileNet-based substance detection because
 * MobileNet is a general image *classifier* (not an object detector).
 * It classifies the entire frame into one of 1000 ImageNet categories,
 * which means random furniture, skin tones, or clothing textures
 * constantly get misclassified as "cigarette", "pill", etc.
 *
 * For substance / drug detection with low false positives you'd need
 * a purpose-trained object detection model (YOLOv8) or a server-side
 * API like Google Cloud Vision SafeSearch / AWS Rekognition.
 *
 * Thresholds are set conservatively per class to minimise false positives:
 *  - "Porn"   → 0.85  (high confidence required)
 *  - "Hentai" → 0.85
 *  - "Sexy"   → 0.97  (almost never fires — this class is extremely noisy)
 */
const CLASS_THRESHOLDS: Record<string, number> = {
  Porn: 0.85,
  Hentai: 0.85,
  Sexy: 0.97,
};

/** How often to run a classification (ms) */
const ANALYSIS_INTERVAL_MS = 2000;

/**
 * How many *consecutive* positive classifications are needed before
 * we actually flag the stream. This eliminates single-frame glitches.
 * At 2 s intervals, 3 consecutive hits = 6 seconds of sustained NSFW
 * content before the block appears.
 */
const CONSECUTIVE_HITS_REQUIRED = 3;

interface NsfwPrediction {
  className: string;
  probability: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NsfwModel = any;

/**
 * Singleton model loader — loads nsfwjs model only once across all
 * hook instances and reuses the same promise / model reference.
 */
let modelPromise: Promise<NsfwModel> | null = null;
let loadedModel: NsfwModel | null = null;

async function loadNsfwModel(): Promise<NsfwModel> {
  if (loadedModel) return loadedModel;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      const tf = await import("@tensorflow/tfjs");

      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch {
        console.warn("WebGL backend not available, falling back to CPU");
        await tf.setBackend("cpu");
        await tf.ready();
      }

      const nsfwjs = await import("nsfwjs");
      const model = await nsfwjs.load();
      loadedModel = model;
      console.log("[NSFW] Model loaded successfully");
      return model;
    } catch (err) {
      console.error("[NSFW] Failed to load model:", err);
      modelPromise = null;
      throw err;
    }
  })();

  return modelPromise;
}

interface UseNsfwDetectionOptions {
  enabled: boolean;
}

interface UseNsfwDetectionReturn {
  modelLoaded: boolean;
  modelLoading: boolean;
  classifyElement: (
    element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => Promise<boolean>;
}

/**
 * Custom hook for NSFW detection using nsfwjs.
 */
export function useNsfwDetection({
  enabled,
}: UseNsfwDetectionOptions): UseNsfwDetectionReturn {
  const [modelLoaded, setModelLoaded] = useState(!!loadedModel);
  const [modelLoading, setModelLoading] = useState(false);
  const modelRef = useRef<NsfwModel | null>(loadedModel);

  useEffect(() => {
    if (!enabled) return;
    if (modelRef.current) {
      setModelLoaded(true);
      return;
    }

    let cancelled = false;
    setModelLoading(true);

    loadNsfwModel()
      .then((model) => {
        if (!cancelled) {
          modelRef.current = model;
          setModelLoaded(true);
          setModelLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const classifyElement = useCallback(
    async (
      element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
    ): Promise<boolean> => {
      const model = modelRef.current;
      if (!model) return false;

      if (element instanceof HTMLVideoElement) {
        if (element.readyState < 2 || element.videoWidth === 0) return false;
      }

      try {
        const predictions: NsfwPrediction[] = await model.classify(element);
        return predictions.some((p) => {
          const threshold = CLASS_THRESHOLDS[p.className];
          return threshold !== undefined && p.probability > threshold;
        });
      } catch (err) {
        console.error("[NSFW] Classification error:", err);
        return false;
      }
    },
    []
  );

  return { modelLoaded, modelLoading, classifyElement };
}

/**
 * Hook that runs periodic NSFW analysis on a video element ref.
 *
 * Uses temporal buffering: the stream is only flagged after
 * CONSECUTIVE_HITS_REQUIRED consecutive positive classifications.
 * A single negative classification resets the counter to zero.
 */
export function useNsfwVideoAnalysis(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  classifyElement: (
    element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => Promise<boolean>,
  options: {
    enabled: boolean;
    intervalMs?: number;
  }
): boolean {
  const { enabled, intervalMs = ANALYSIS_INTERVAL_MS } = options;
  const [isNsfw, setIsNsfw] = useState(false);
  const analysisRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setIsNsfw(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let consecutiveHits = 0;

    const interval = setInterval(async () => {
      if (analysisRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      analysisRef.current = true;
      try {
        const result = await classifyElement(video);

        if (result) {
          consecutiveHits++;
          if (consecutiveHits >= CONSECUTIVE_HITS_REQUIRED) setIsNsfw(true);
        } else {
          consecutiveHits = 0;
          setIsNsfw(false);
        }
      } finally {
        analysisRef.current = false;
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, intervalMs, classifyElement, videoRef]);

  return isNsfw;
}
