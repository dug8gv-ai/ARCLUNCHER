'use client';

import dynamic from 'next/dynamic';

// ssr:false is allowed here because this is a Client Component
const RainBackground = dynamic(
  () => import('@/components/RainBackground').then(m => ({ default: m.RainBackground })),
  { ssr: false }
);

export function RainBackgroundClient() {
  return <RainBackground />;
}
