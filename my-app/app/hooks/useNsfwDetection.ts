"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * NSFW Detection categories returned by nsfwjs.
 * We flag "Porn", "Hentai", and "Sexy" as potentially NSFW.
 */
const NSFW_CLASSES = ["Porn", "Hentai", "Sexy"];
const NSFW_THRESHOLD = 0.6;
const ANALYSIS_INTERVAL_MS = 1500; // Check every 1.5 seconds to balance accuracy and performance

interface NsfwPrediction {
  className: string;
  probability: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NsfwModel = any;

/**
 * Singleton model loader — loads nsfwjs model only once across all hook instances
 * and reuses the same promise/model reference.
 */
let modelPromise: Promise<NsfwModel> | null = null;
let loadedModel: NsfwModel | null = null;

async function loadNsfwModel(): Promise<NsfwModel> {
  if (loadedModel) return loadedModel;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      // Dynamically import TensorFlow.js and nsfwjs to keep bundle small
      // and only load on the client side
      const tf = await import("@tensorflow/tfjs");

      // Set the backend to webgl for best performance, fallback to cpu
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
      modelPromise = null; // Allow retry on next call
      throw err;
    }
  })();

  return modelPromise;
}

interface UseNsfwDetectionOptions {
  /** Whether NSFW detection is enabled (e.g. only in video mode) */
  enabled: boolean;
}

interface UseNsfwDetectionReturn {
  /** Whether the NSFW model has finished loading */
  modelLoaded: boolean;
  /** Whether the model is currently loading */
  modelLoading: boolean;
  /** Classify a single video/image element. Returns true if NSFW. */
  classifyElement: (
    element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ) => Promise<boolean>;
}

/**
 * Custom hook for NSFW detection using nsfwjs.
 *
 * Loads the TensorFlow.js model once (singleton) and provides
 * a `classifyElement` function to check any video/image element.
 */
export function useNsfwDetection({
  enabled,
}: UseNsfwDetectionOptions): UseNsfwDetectionReturn {
  const [modelLoaded, setModelLoaded] = useState(!!loadedModel);
  const [modelLoading, setModelLoading] = useState(false);
  const modelRef = useRef<NsfwModel | null>(loadedModel);

  // Load model when enabled
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

      // For video elements, ensure the video has data
      if (element instanceof HTMLVideoElement) {
        if (element.readyState < 2 || element.videoWidth === 0) return false;
      }

      try {
        const predictions: NsfwPrediction[] = await model.classify(element);
        return predictions.some(
          (p) =>
            NSFW_CLASSES.includes(p.className) &&
            p.probability > NSFW_THRESHOLD
        );
      } catch (err) {
        console.error("[NSFW] Classification error:", err);
        return false;
      }
    },
    []
  );

  return {
    modelLoaded,
    modelLoading,
    classifyElement,
  };
}

/**
 * Hook that runs periodic NSFW analysis on a video element ref.
 *
 * Returns whether the video is currently flagged as NSFW.
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
  const analysisRef = useRef(false); // guard against overlapping classifications

  // Reset NSFW state when analysis is disabled
  useEffect(() => {
    if (!enabled) {
      setIsNsfw(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      // Skip if a previous classification is still running
      if (analysisRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        return;
      }

      analysisRef.current = true;
      try {
        const result = await classifyElement(video);
        setIsNsfw(result);
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
