import type { LeagueName } from "@/domain/types";
import { LEAGUE_VISUALS } from "@/domain/visual-identity";
import type { ReactNode } from "react";

export type LeagueIconName = "shield" | "belt" | "table" | "fight-card" | "calendar" | "result" | "simulation" | "review" | "history" | "rulebook" | "finals";

export function LeagueCrest({ league, size = "medium" }: { league: LeagueName; size?: "small" | "medium" | "large" }) {
  const visual = LEAGUE_VISUALS[league];
  return <span className={`league-crest league-${visual.key} crest-${size}`} aria-label={`${league} crest`}><span>{visual.monogram}</span></span>;
}

export function LeagueIcon({ name, className = "" }: { name: LeagueIconName; className?: string }) {
  const paths: Record<LeagueIconName, ReactNode> = {
    shield: <path d="M12 2 4.5 5v6.1c0 4.8 3.1 8.8 7.5 10.9 4.4-2.1 7.5-6.1 7.5-10.9V5L12 2Zm0 4 4 1.5v3.6c0 2.8-1.5 5.3-4 7-2.5-1.7-4-4.2-4-7V7.5L12 6Z" />,
    belt: <><path d="M2 9h5v6H2l-1-3 1-3Zm20 0h-5v6h5l1-3-1-3Z"/><path d="M7 6h10l2 6-2 6H7l-2-6 2-6Zm5 3-2 3 2 3 2-3-2-3Z"/></>,
    table: <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4v2h12V7H6Zm0 4v2h4v-2H6Zm6 0v2h6v-2h-6Zm-6 4v2h4v-2H6Zm6 0v2h6v-2h-6Z" />,
    "fight-card": <path d="M4 3h16v18H4V3Zm3 4v2h10V7H7Zm0 4v2h4v-2H7Zm6 0v2h4v-2h-4Zm-6 4v2h4v-2H7Zm6 0v2h4v-2h-4Z" />,
    calendar: <path d="M5 2h2v2h10V2h2v2h3v18H2V4h3V2Zm-1 8v10h16V10H4Zm3 3h4v4H7v-4Z" />,
    result: <path d="m9.2 18.2-5.4-5.4 2.4-2.4 3 3 8.6-8.6 2.4 2.4-11 11Z" />,
    simulation: <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8-7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />,
    review: <path d="M12 2 1 21h22L12 2Zm-1 7h2v6h-2V9Zm0 8h2v2h-2v-2Z" />,
    history: <path d="M6 3h12v3h3v4c0 3-2 5-5 5.8A5.1 5.1 0 0 1 13 18v2h4v2H7v-2h4v-2a5.1 5.1 0 0 1-3-2.2C5 15 3 13 3 10V6h3V3Zm12 5v4.8c.7-.6 1-1.5 1-2.8V8h-1ZM5 8v2c0 1.3.3 2.2 1 2.8V8H5Z" />,
    rulebook: <path d="M4 2h13a3 3 0 0 1 3 3v17H6a3 3 0 0 1-3-3V3a1 1 0 0 1 1-1Zm2 15a3 3 0 0 0-1 .2V19a1 1 0 0 0 1 1h12v-3H6Zm1-11v2h8V6H7Zm0 4v2h8v-2H7Z" />,
    finals: <path d="M4 3h16v4h2v14H2V7h2V3Zm3 3v3h10V6H7Zm-2 5v7h14v-7h-2v3h-3v-3h-4v3H7v-3H5Z" />,
  };
  return <svg className={`league-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
