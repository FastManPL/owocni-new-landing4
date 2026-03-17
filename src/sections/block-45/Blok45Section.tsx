'use client';

import dynamic from 'next/dynamic';

const Blok45Engine = dynamic(() => import('./Blok45Engine'), { ssr: false });

export function Blok45Section() {
  return (
    <>
      <section aria-hidden="true" style={{ minHeight: '100vh' }} />
      <Blok45Engine />
    </>
  );
}
