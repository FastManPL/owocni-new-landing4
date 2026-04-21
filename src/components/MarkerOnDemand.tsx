"use client";

import { useEffect, useRef } from "react";

/**
 * Marker.io tylko na żądanie — pakiet @marker.io/browser trafia do osobnego chunka
 * i nie jest pobierany, dopóki nie wywołasz ładowania.
 *
 * Sposoby wywołania (wymaga NEXT_PUBLIC_MARKER_PROJECT_ID):
 * - URL: ?marker=1
 * - Klawisze: Shift + Alt + M
 * - Konsola: await window.__owocniLoadMarker?.()
 */
export function MarkerOnDemand() {
  const loadStarted = useRef(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_MARKER_PROJECT_ID?.trim();
    if (!projectId) return;

    const load = async () => {
      if (loadStarted.current) return;
      loadStarted.current = true;
      try {
        const markerSDK = (await import("@marker.io/browser")).default;
        await markerSDK.loadWidget({
          project: projectId,
          source: "owocni-on-demand",
          keyboardShortcuts: false,
          networkRecording: { enabled: false },
        });
      } catch (e) {
        loadStarted.current = false;
        console.warn("[MarkerOnDemand] loadWidget failed", e);
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("marker") === "1") {
      void load();
    }

    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || !e.altKey || e.repeat) return;
      if (e.key !== "m" && e.key !== "M") return;
      void load();
    };
    window.addEventListener("keydown", onKey);

    const w = window as Window & { __owocniLoadMarker?: () => Promise<void> };
    w.__owocniLoadMarker = load;

    return () => {
      window.removeEventListener("keydown", onKey);
      delete w.__owocniLoadMarker;
    };
  }, []);

  return null;
}
