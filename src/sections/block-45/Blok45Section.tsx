'use client';

import dynamic from 'next/dynamic';

const Blok45Engine = dynamic(() => import('./Blok45Engine'), { ssr: false });

export function Blok45Section() {
  return <Blok45Engine />;
}
