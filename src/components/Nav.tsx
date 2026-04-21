import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/calculator", label: "Hyperion" },
  { href: "/terminator", label: "Terminator" },
  { href: "/kuudra-armor", label: "Kuudra armor" },
  { href: "/breakdown", label: "Breakdown" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tracker", label: "Tracker" },
  { href: "/browse", label: "Browse" },
  { href: "/hyperion-bin-verify", label: "Hyp verify" },
  { href: "/bin-sniper", label: "BIN SNIPER" },
  { href: "/player-watch", label: "Player watch" },
  { href: "/ingestions", label: "Ingestions" },
  { href: "/wide-bin-scan", label: "Wide scan" },
  { href: "/ah-snapshot", label: "AH snapshot" },
  { href: "/bazaar-snapshot", label: "Bazaar" },
];

export function Nav() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-100"
        >
          Mansif<span className="text-sky-400">Tracker</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
