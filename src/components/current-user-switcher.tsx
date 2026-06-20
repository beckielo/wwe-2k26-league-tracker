"use client";

import { useEffect } from "react";
import { getActiveCurrentUserOptions, resolveCurrentUser } from "@/domain/current-user";
import type { StandingRow } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

export function useCurrentUser(standings: StandingRow[]) {
  const { state, updateState, hydrated } = useTrackerState();
  const currentUser = resolveCurrentUser(standings, state.currentUserWrestler);
  useEffect(() => {
    if (hydrated && currentUser && state.currentUserWrestler !== currentUser.wrestler) {
      updateState((current) => ({ ...current, currentUserWrestler: currentUser.wrestler }));
    }
  }, [currentUser, hydrated, state.currentUserWrestler, updateState]);
  const setCurrentUser = (wrestler: string) => {
    const valid = resolveCurrentUser(standings, wrestler);
    if (!valid || valid.wrestler !== wrestler) return;
    updateState((current) => ({ ...current, currentUserWrestler: valid.wrestler }));
  };
  return { currentUser, setCurrentUser, options: getActiveCurrentUserOptions(standings) };
}

export function CurrentUserSwitcher({ standings }: { standings: StandingRow[] }) {
  const { currentUser, setCurrentUser, options } = useCurrentUser(standings);
  if (!currentUser) return null;

  return <section className="current-user-switcher" aria-label="Current User">
    <label htmlFor="current-user-select">
      <span>Current User</span>
      <strong>{currentUser.wrestler}</strong>
    </label>
    <select
      id="current-user-select"
      value={currentUser.wrestler}
      onChange={(event) => setCurrentUser(event.target.value)}
    >
      {options.map((option) => <option key={`${option.league}-${option.wrestler}`} value={option.wrestler}>
        {option.wrestler} — {option.league}
      </option>)}
    </select>
    <p>Current League: {currentUser.league}</p>
  </section>;
}
