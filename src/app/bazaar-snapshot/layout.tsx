import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Bazaar snapshot — MansifTracker",
  description:
    "Live Hypixel bazaar order book: insta-buy / insta-sell summaries and depth tables.",
};

export default function BazaarSnapshotLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
