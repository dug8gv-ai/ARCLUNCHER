'use client';

import dynamic from 'next/dynamic';

const RainBackground = dynamic(
  () => import('@/components/RainBackground').then(m => ({ default: m.RainBackground })),
  { ssr: false }
);

const GridBackground = dynamic(
  () => import('@/components/GridBackground').then(m => ({ default: m.GridBackground })),
  { ssr: false }
);

export function RainBackgroundClient() {
  return (
    <>
      <GridBackground />
      <RainBackground />
    </>
  );
}
