"use client";

import Link from "next/link";
import { useTrackerState } from "@/state/tracker-state-provider";

export function ManualReviewBanner() {
  const { state, hydrated } = useTrackerState();
  const open = (state.manualReviews ?? []).filter((review) => review.status === "open");
  if (!hydrated || open.length === 0) return null;
  return <div className="border-b border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm text-amber-100">
    <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
      <strong>{open.length} Manual Review {open.length === 1 ? "item" : "items"} open — affected finalization is blocked.</strong>
      <Link href="/results" className="font-black uppercase tracking-wider underline">Review results</Link>
    </div>
  </div>;
}
