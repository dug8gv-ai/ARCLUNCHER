'use client';

import dynamic from 'next/dynamic';

const EnvironmentalEffects = dynamic(
  () => import('@/components/EnvironmentalEffects').then(m => ({ default: m.EnvironmentalEffects })),
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
      <EnvironmentalEffects />
    </>
  );
}
