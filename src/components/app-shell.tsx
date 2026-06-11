import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  ["Dashboard", "/"],
  ["Schedule", "/schedule"],
  ["Standings", "/standings"],
  ["Result Entry", "/results"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080b11]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-5 py-4 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center bg-red-500 text-lg font-black italic shadow-[5px_5px_0_#fff]">2K</span>
            <span>
              <strong className="block text-sm font-black uppercase tracking-[.18em]">League Control</strong>
              <span className="text-xs text-slate-400">WWE 2K26 Tracker</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 p-1 text-sm">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white sm:px-4">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 py-8 lg:px-10 lg:py-12">{children}</main>
      <footer className="mx-auto flex max-w-[1500px] justify-between border-t border-white/10 px-5 py-6 text-xs uppercase tracking-[.14em] text-slate-500 lg:px-10">
        <span>Workbook authoritative</span><span>No simulated fixtures</span>
      </footer>
    </div>
  );
}
