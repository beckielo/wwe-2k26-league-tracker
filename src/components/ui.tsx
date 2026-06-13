import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[.24em] text-red-400">{children}</p>;
}

export function PageHeader({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end">
    <div className="max-w-3xl"><Eyebrow>{eyebrow}</Eyebrow><h1 className="text-4xl font-black uppercase tracking-[-.04em] sm:text-6xl">{title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">{description}</p></div>
    {aside}
  </div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-white/10 bg-[#111722]/90 shadow-2xl shadow-black/20 ${className}`}>{children}</section>;
}

export function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="relative overflow-hidden border border-white/10 bg-[#111722] p-5">
    <span className="absolute right-0 top-0 h-1 w-16 bg-red-500" />
    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    {detail && <p className="mt-2 text-sm text-slate-400">{detail}</p>}
  </div>;
}
