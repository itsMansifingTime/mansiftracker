import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BIN SNIPER — MansifTracker",
};

export default function BinSniperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
