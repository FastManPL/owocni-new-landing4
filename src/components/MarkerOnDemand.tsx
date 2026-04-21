"use client";

import { useEffect, useRef } from "react";

function markerEnabledFromSearch(): boolean {
  if (typeof window === "undefined") return false;
  const v = new URLSearchParams(window.location.search).get("marker");
  return v === "1" || v === "true";
}

/**
 * Marker.io tylko przy wejściu z `?marker=1` (lub `marker=true`) w URL.
 * Chunk `@marker.io/browser` ładuje się dopiero wtedy — brak skrótów klawiszowych.
 * Po `loadWidget` wywołujemy `show()`, żeby przycisk / panel były widoczne (wcześniej bez tego widget mógł zostać ukryty).
 *
 * Wymaga `NEXT_PUBLIC_MARKER_PROJECT_ID` (ID projektu z panelu Marker).
 */
export function MarkerOnDemand() {
  const inFlight = useRef(false);
  const done = useRef(false);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_MARKER_PROJECT_ID?.trim();
    if (!projectId) return;

    const run = async () => {
      if (!markerEnabledFromSearch() || done.current || inFlight.current) return;
      inFlight.current = true;
      try {
        const markerSDK = (await import("@marker.io/browser")).default;
        const widget = await markerSDK.loadWidget({
          project: projectId,
          source: "owocni-url-marker",
          keyboardShortcuts: false,
          networkRecording: { enabled: false },
        });
        widget.show();
        done.current = true;
      } catch (e) {
        console.warn("[MarkerOnDemand] loadWidget failed", e);
      } finally {
        inFlight.current = false;
      }
    };

    void run();

    const onHrefChange = () => {
      if (done.current) return;
      void run();
    };
    window.addEventListener("popstate", onHrefChange);
    return () => window.removeEventListener("popstate", onHrefChange);
  }, []);

  return null;
}
