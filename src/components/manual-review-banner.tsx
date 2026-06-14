"use client";

import Link from "next/link";
import { useTrackerState } from "@/state/tracker-state-provider";

export function ManualReviewBanner() {
  const { state, hydrated } = useTrackerState();
  const open = (state.manualReviews ?? []).filter((review) => review.status === "open");
  if (!hydrated || open.length === 0) return null;
  return <div className="review-strip">
    <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
      <strong>Review required · {open.length} {open.length === 1 ? "item" : "items"} affecting finalization</strong>
      <Link href="/results" className="font-black uppercase tracking-wider underline">Review results</Link>
    </div>
  </div>;
}
