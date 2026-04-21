"use client";

import { useEffect } from "react";

function markerEnabledFromSearch(): boolean {
  if (typeof window === "undefined") return false;
  const v = new URLSearchParams(window.location.search).get("marker");
  return v === "1" || v === "true";
}

/**
 * Oficjalny snippet Marker.io (markerConfig + bootstrap → edge.marker.io shim).
 * Ładuje się tylko przy `?marker=1` / `?marker=true` — bez npm SDK.
 *
 * @see https://help.marker.io — instalacja przez snippet
 *
 * Wymaga `NEXT_PUBLIC_MARKER_PROJECT_ID` (to samo pole `project` co w panelu).
 */
const MARKER_BOOTSTRAP = `!function(e,r,a){if(!e.__Marker){e.__Marker={};var t=[],n={__cs:t};["show","hide","isVisible","capture","cancelCapture","unload","reload","isExtensionInstalled","setReporter","clearReporter","setCustomData","on","off"].forEach(function(e){n[e]=function(){var r=Array.prototype.slice.call(arguments);r.unshift(e),t.push(r)}}),e.Marker=n;var s=r.createElement("script");s.async=1,s.src="https://edge.marker.io/latest/shim.js";s.setAttribute("data-marker-shim-loader","1");var i=r.getElementsByTagName("script")[0];i.parentNode.insertBefore(s,i)}}(window,document);`;

function injectMarkerSnippet(projectId: string): void {
  const w = window as Window & {
    __Marker?: unknown;
    markerConfig?: { project: string; source: string };
  };
  if (w.__Marker) return;

  w.markerConfig = {
    project: projectId,
    source: "snippet",
  };

  const boot = document.createElement("script");
  boot.setAttribute("data-marker-bootstrap", "1");
  boot.textContent = MARKER_BOOTSTRAP;
  document.body.appendChild(boot);
}

export function MarkerOnDemand() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_MARKER_PROJECT_ID?.trim();
    if (!projectId) return;

    const tryInject = () => {
      if (!markerEnabledFromSearch()) return;
      injectMarkerSnippet(projectId);
    };

    tryInject();
    window.addEventListener("popstate", tryInject);
    return () => window.removeEventListener("popstate", tryInject);
  }, []);

  return null;
}
