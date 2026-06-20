"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  if (!currentUser) return null;

  const selectedOptionId = `${listboxId}-${currentUser.wrestler.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const triggerValueId = `${listboxId}-value`;

  return <section ref={switcherRef} className="current-user-switcher" aria-label="Current User">
    <div className="current-user-switcher-label" id={`${listboxId}-label`}>
      <span>Current User</span>
      <strong>{currentUser.wrestler}</strong>
    </div>
    <div className="current-user-combobox">
      <button
        type="button"
        className="current-user-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label ${triggerValueId}`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span id={triggerValueId}>{currentUser.wrestler} — {currentUser.league}</span>
        <span className="current-user-trigger-icon" aria-hidden>⌄</span>
      </button>
      {isOpen && <div className="current-user-options-panel" role="presentation">
        <ul className="current-user-options" id={listboxId} role="listbox" aria-labelledby={`${listboxId}-label`} aria-activedescendant={selectedOptionId} tabIndex={-1}>
          {options.map((option) => {
            const selected = option.wrestler === currentUser.wrestler;
            const optionId = `${listboxId}-${option.wrestler.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
            return <li key={`${option.league}-${option.wrestler}`} role="option" aria-selected={selected} id={optionId}>
              <button
                type="button"
                className="current-user-option"
                onClick={() => {
                  setCurrentUser(option.wrestler);
                  setIsOpen(false);
                }}
              >
                <span>{option.wrestler} — {option.league}</span>
              </button>
            </li>;
          })}
        </ul>
      </div>}
    </div>
    <p>Current League: {currentUser.league}</p>
  </section>;
}
