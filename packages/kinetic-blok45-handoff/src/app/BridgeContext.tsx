'use client';

import { createContext, useContext, type RefObject } from 'react';

/**
 * Kontekst Makro-Sekcji (integracja §7A).
 * Gdy Fakty + Kinetic są wewnątrz #bridge-wrapper, Kinetic używa wrapperRef jako triggera pina.
 */
export type BridgeContextValue = {
  wrapperRef: RefObject<HTMLDivElement | null>;
  /** Ref do wrappera użytego jako pinSpacer — zapobiega insertBefore przy pinie (React + GSAP). */
  pinSpacerRef?: RefObject<HTMLDivElement | null>;
  faktyLayerRef: RefObject<HTMLDivElement | null>;
  /** Jednostki timeline na fazę Fakty (yPercent -100). Gdy 0 = brak fazy Fakty. */
  bridgeFaktyU: number;
};

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function useBridgeContext(): BridgeContextValue | null {
  return useContext(BridgeContext);
}

export function BridgeProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: BridgeContextValue;
}) {
  return (
    <BridgeContext.Provider value={value}>
      {children}
    </BridgeContext.Provider>
  );
}
