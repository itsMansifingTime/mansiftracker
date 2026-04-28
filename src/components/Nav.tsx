"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const sections = [
  {
    label: "Main",
    links: [{ href: "/", label: "Home" }, { href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Calculators",
    links: [
      { href: "/calculator", label: "Hyperion" },
      { href: "/terminator", label: "Terminator" },
      { href: "/kuudra-armor", label: "Kuudra armor" },
      { href: "/breakdown", label: "Breakdown" },
    ],
  },
  {
    label: "Scanners",
    links: [
      { href: "/browse", label: "Browse" },
      { href: "/bin-sniper", label: "BIN sniper" },
      { href: "/wide-bin-scan", label: "Wide scan" },
      { href: "/hyperion-bin-verify", label: "Hyp verify" },
    ],
  },
  {
    label: "Trackers",
    links: [
      { href: "/tracker", label: "Tracker" },
      { href: "/player-watch", label: "Player watch" },
      { href: "/ingestions", label: "Ingestions" },
    ],
  },
  {
    label: "Snapshots",
    links: [
      { href: "/ah-snapshot", label: "AH snapshot" },
      { href: "/bazaar-snapshot", label: "Bazaar" },
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/fire-sale-skins", label: "Fire sale skins" },
      { href: "/bazaar-snapshot", label: "Bazaar" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <Link
          href="/"
          className="w-fit text-sm font-semibold tracking-tight text-zinc-100 transition hover:text-white"
        >
          Mansif<span className="text-sky-400">Tracker</span>
        </Link>
        <nav className="flex w-full flex-wrap gap-2 text-sm sm:justify-end">
          {sections.map((section) => (
            <div
              key={section.label}
              className="relative shrink-0"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenSection((prev) => (prev === section.label ? null : section.label))
                }
                className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 ${
                  openSection === section.label
                    ? "border-zinc-700 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {section.label}
                <span className="text-[10px]">{openSection === section.label ? "▲" : "▼"}</span>
              </button>
              {openSection === section.label ? (
                <div className="absolute left-0 top-[calc(100%+0.35rem)] z-40 min-w-44 rounded-lg border border-zinc-800 bg-zinc-900/95 p-1 shadow-xl">
                  {section.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpenSection(null)}
                      className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 ${
                        pathname === l.href
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
