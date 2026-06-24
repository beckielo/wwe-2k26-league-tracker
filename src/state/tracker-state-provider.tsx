"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  TRACKER_STATE_STORAGE_KEY,
  createEmptyTrackerState,
  exportTrackerState,
  importTrackerState,
  resetTrackerState,
  recoverPostRegularSeasonWorkflowState,
  type TrackerState,
} from "@/domain/tracker-state";
import { reconcileCompletedSplitHistory } from "@/domain/completed-split-reconciliation";
import type { LeagueName, Match } from "@/domain/types";

interface TrackerStateContextValue {
  state: TrackerState;
  hydrated: boolean;
  replaceState: (state: TrackerState) => void;
  updateState: (updater: (current: TrackerState) => TrackerState) => void;
  exportState: () => string;
  importState: (json: string, matches: Match[], userLeague: LeagueName) => string[];
  resetState: () => void;
}

const TrackerStateContext = createContext<TrackerStateContextValue | null>(null);

export function TrackerStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrackerState>(createEmptyTrackerState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as TrackerState;
          if (parsed.version === 1) {
            const recovered = reconcileCompletedSplitHistory(recoverPostRegularSeasonWorkflowState(parsed));
            setState(recovered);
            if (JSON.stringify(recovered) !== JSON.stringify(parsed)) window.localStorage.setItem(TRACKER_STATE_STORAGE_KEY, JSON.stringify(recovered));
          }
        } catch {
          window.localStorage.removeItem(TRACKER_STATE_STORAGE_KEY);
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = useCallback((next: TrackerState) => {
    const reconciled = reconcileCompletedSplitHistory(next);
    setState(reconciled);
    window.localStorage.setItem(TRACKER_STATE_STORAGE_KEY, JSON.stringify(reconciled));
  }, []);

  const value = useMemo<TrackerStateContextValue>(() => ({
    state,
    hydrated,
    replaceState: persist,
    updateState: (updater) => persist(updater(state)),
    exportState: () => {
      const exported = exportTrackerState(state);
      persist(exported.state);
      return exported.json;
    },
    importState: (json, matches, userLeague) => {
      const imported = importTrackerState(json, matches, userLeague);
      if (imported.ok) persist(imported.state);
      return imported.errors;
    },
    resetState: () => {
      const empty = resetTrackerState();
      persist(empty);
    },
  }), [hydrated, persist, state]);

  return <TrackerStateContext.Provider value={value}>{children}</TrackerStateContext.Provider>;
}

export function useTrackerState(): TrackerStateContextValue {
  const value = useContext(TrackerStateContext);
  if (!value) throw new Error("useTrackerState must be used inside TrackerStateProvider.");
  return value;
}
