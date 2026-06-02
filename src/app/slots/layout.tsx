import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ArcSlots | ArcOmni Pro',
  description: 'Spin the slots and win ARC rewards on Arc Testnet',
};

export default function SlotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No additional wrappers needed - inherits Web3Provider from root layout
  return <>{children}</>;
}
