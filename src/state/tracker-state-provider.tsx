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
import {
  resolveWorkflowContextAuthority,
  signLocalWorkflowContext,
  type WorkflowContextAuthority,
  type WorkflowContextBaseline,
} from "@/domain/workflow-context";

interface TrackerStateContextValue {
  state: TrackerState;
  authority: WorkflowContextAuthority;
  hydrated: boolean;
  replaceState: (state: TrackerState) => void;
  updateState: (updater: (current: TrackerState) => TrackerState) => void;
  exportState: () => string;
  importState: (json: string, matches: Match[], userLeague: LeagueName) => string[];
  resetState: () => void;
}

const TrackerStateContext = createContext<TrackerStateContextValue | null>(null);

const defaultWorkflowContext: WorkflowContextBaseline = {
  dashboard: {
    source: "workbook-dashboard",
    valid: true,
    leagueYear: 2,
    split: "Opening Split",
    activeYearWeek: 1,
    completedThroughYearWeek: 0,
    splitWeek: 1,
    phase: "setup",
    scheduleSource: "Workbook schedule",
    standingsSource: "Workbook standings",
    resultsSource: "Workbook results",
    finalsReadiness: "not-ready",
    sourceSignature: "workflow-default",
    confidence: "low",
    conflicts: [],
  },
  appWorkbook: null,
  selected: "workbook-dashboard",
  schedule: [],
  conflicts: [],
};

export function TrackerStateProvider({
  children,
  workflowContext = defaultWorkflowContext,
}: {
  children: ReactNode;
  workflowContext?: WorkflowContextBaseline;
}) {
  const [storedState, setStoredState] = useState<TrackerState>(createEmptyTrackerState);
  const [hydrated, setHydrated] = useState(false);
  const baselineSourceSignature = workflowContext.selected === "app-workbook" && workflowContext.appWorkbook?.valid
    ? workflowContext.appWorkbook.sourceSignature
    : workflowContext.dashboard.sourceSignature;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(TRACKER_STATE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as TrackerState;
          if (parsed.version === 1) {
            const recovered = reconcileCompletedSplitHistory(recoverPostRegularSeasonWorkflowState(parsed));
            setStoredState(recovered);
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
    const signed = signLocalWorkflowContext(next, baselineSourceSignature);
    const reconciled = reconcileCompletedSplitHistory(signed);
    setStoredState(reconciled);
    window.localStorage.setItem(TRACKER_STATE_STORAGE_KEY, JSON.stringify(reconciled));
  }, [baselineSourceSignature]);
  const authority = useMemo(
    () => resolveWorkflowContextAuthority(workflowContext, storedState, hydrated),
    [hydrated, storedState, workflowContext],
  );
  const state = useMemo(
    () => authority.localStateAccepted ? storedState : {
      ...storedState,
      confirmedResults: [],
      completedWeeks: [],
      acceptedSchedule: undefined,
      activeWorkflow: undefined,
    },
    [authority.localStateAccepted, storedState],
  );

  const value = useMemo<TrackerStateContextValue>(() => ({
    state,
    authority,
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
  }), [authority, hydrated, persist, state]);

  return <TrackerStateContext.Provider value={value}>{children}</TrackerStateContext.Provider>;
}

export function useTrackerState(): TrackerStateContextValue {
  const value = useContext(TrackerStateContext);
  if (!value) throw new Error("useTrackerState must be used inside TrackerStateProvider.");
  return value;
}
