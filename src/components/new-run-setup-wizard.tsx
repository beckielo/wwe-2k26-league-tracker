"use client";

import { useMemo, useState } from "react";
import { activateFreshRunSetup, addCawToDraft, createEmptyNewRunSetupDraft, generateAutomaticRosterDraft, NEW_RUN_START_BASIS, normalizeSetupName, validateNewRunSetupDraft, type NewRunSetupDraft } from "@/domain/new-run-setup";
import { LEAGUE_NAMES, type LeagueName, type TrackerMeta } from "@/domain/types";
import { useTrackerState } from "@/state/tracker-state-provider";

type Step = "closed" | "warning" | "basis" | "caw-choice" | "caw-entry" | "roster-mode" | "manual" | "automatic" | "preview" | "confirm";

export function NewRunSetupWizard({ meta }: { meta: TrackerMeta }) {
  const { state, replaceState, updateState, exportState } = useTrackerState();
  const [step, setStep] = useState<Step>("closed");
  const [draft, setDraft] = useState<NewRunSetupDraft>(() => state.newRunSetupDraft ?? createEmptyNewRunSetupDraft());
  const [cawName, setCawName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const validation = useMemo(() => validateNewRunSetupDraft(draft), [draft]);

  function persist(next: NewRunSetupDraft) {
    setDraft(next);
    updateState((current) => ({ ...current, newRunSetupDraft: next }));
  }

  function close() {
    setStep("closed");
    setErrors([]);
  }

  function recordBackup(choice: NonNullable<NewRunSetupDraft["backupChoice"]>) {
    const next = { ...draft, backupChoice: choice };
    persist(next);
    setStep("basis");
  }

  function createBackupAndContinue() {
    try {
      exportState();
      recordBackup("created");
    } catch {
      recordBackup("not-available");
      setErrors(["Backup/export is not available in this environment. Setup can continue safely, but no backup was created."]);
    }
  }

  function addCaw() {
    const result = addCawToDraft(draft, cawName);
    if (result.errors.length) {
      setErrors(result.errors);
      return;
    }
    persist(result.draft);
    setCawName("");
    setErrors([]);
    setStep("caw-choice");
  }

  function setRosterMode(mode: "manual" | "automatic") {
    if (mode === "automatic") {
      regenerateAutomaticRoster();
      setStep("automatic");
      return;
    }
    persist({ ...draft, rosterMode: mode });
    setStep("manual");
  }

  function regenerateAutomaticRoster() {
    const result = generateAutomaticRosterDraft({ ...draft, rosterMode: "automatic" });
    persist(result.draft);
    setErrors(result.errors);
  }


  function requestActivation() {
    if (!validation.valid || !validation.readyForActivation) return;
    setErrors([]);
    setStep("confirm");
  }

  function activate() {
    const result = activateFreshRunSetup(state, draft);
    if (!result.ok) {
      setErrors(result.errors);
      setStep("preview");
      return;
    }
    replaceState(result.state);
    setDraft(createEmptyNewRunSetupDraft());
    setSuccess("Fresh run activated: League Year 1, Opening Split, Week 1.");
    setStep("closed");
    setErrors([]);
  }

  function updateManualSlot(league: LeagueName, index: number, value: string) {
    const manualRoster = { ...draft.manualRoster, [league]: [...draft.manualRoster[league]] };
    manualRoster[league][index] = value;
    persist({ ...draft, rosterMode: "manual", manualRoster });
  }

  return <section className="management-card new-run-card" aria-labelledby="new-run-title">
    <div className="management-card-copy">
      <p className="broadcast-kicker">Run management</p>
      <h2 id="new-run-title">Create New Run</h2>
      <p>Prepare and activate a fresh League Year 1 setup with CAWs, roster assignment, validation, preview, and explicit final confirmation before replacing the active run.</p>
    </div>
    <button className="action-button action-primary" onClick={() => setStep("warning")}>Create New Run</button>
    {success && <div className="new-run-validation warning" role="status"><strong>{success}</strong></div>}

    {step !== "closed" && <div className="new-run-wizard" role="dialog" aria-modal="false" aria-labelledby="new-run-wizard-title">
      <header className="new-run-wizard-header"><div><p className="broadcast-kicker">Fresh run setup wizard</p><h3 id="new-run-wizard-title">Create New Run Draft</h3></div></header>
      {errors.length > 0 && <ValidationMessages title="Setup notice" messages={errors} tone="error" />}

      {step === "warning" && <WizardStep title="Active run overwrite warning" description="The current active run will be overwritten only after final confirmation. Do you want to create a backup first?">
        <div className="new-run-actions"><button className="action-button action-primary" onClick={createBackupAndContinue}>Yes, create backup and continue</button><button className="action-button action-secondary" onClick={() => recordBackup("skipped")}>No, continue without backup</button><button className="action-button action-secondary" onClick={close}>Cancel</button></div>
      </WizardStep>}

      {step === "basis" && <WizardStep title="Fresh Run Start" description="The new active run will start from this basis after final confirmation.">
        <ul className="new-run-summary-list"><li>League Year {NEW_RUN_START_BASIS.leagueYear}</li><li>{NEW_RUN_START_BASIS.split}</li><li>Week {NEW_RUN_START_BASIS.week}</li><li>Rule Version: {meta.currentStatus || "Current rule version"}</li></ul>
        <button className="action-button action-primary" onClick={() => setStep("caw-choice")}>Continue to CAW setup</button>
      </WizardStep>}

      {step === "caw-choice" && <WizardStep title="Do you want to add a CAW?" description="CAWs are tracked in the draft and can be typed into manual seed slots like normal wrestlers.">
        <CawList caws={draft.caws} /><div className="new-run-actions"><button className="action-button action-primary" onClick={() => setStep("caw-entry")}>Yes</button><button className="action-button action-secondary" onClick={() => setStep("roster-mode")}>No</button></div>
      </WizardStep>}

      {step === "caw-entry" && <WizardStep title="CAW name" description="Names are trimmed and checked case-insensitively against existing CAWs and manual roster entries.">
        <label className="new-run-label">CAW name<input value={cawName} onChange={(event) => setCawName(event.target.value)} placeholder="Type CAW name" /></label>
        <div className="new-run-actions"><button className="action-button action-primary" onClick={addCaw}>Add CAW</button><button className="action-button action-secondary" onClick={() => setStep("roster-mode")}>No more CAWs</button></div><CawList caws={draft.caws} />
      </WizardStep>}

      {step === "roster-mode" && <WizardStep title="How do you want to assign the roster?" description="Manual validates 48 unique active wrestlers. Automatic randomly fills 48 active wrestlers from CAWs plus the hidden internal pool.">
        <div className="new-run-actions"><button className="action-button action-primary" onClick={() => setRosterMode("manual")}>Manual</button><button className="action-button action-secondary" onClick={() => setRosterMode("automatic")}>Automatic</button></div>
      </WizardStep>}

      {step === "manual" && <WizardStep title="Manual roster seeds" description="Fill Global, Continental, National, and Regional League seeds 1–12. CAWs are not auto-placed; type them into slots if they should be active.">
        <ManualRosterEditor draft={draft} updateManualSlot={updateManualSlot} />
        <ValidationPanel validation={validation} />
        <button className="action-button action-primary" onClick={() => setStep("preview")}>Preview setup</button>
      </WizardStep>}

      {step === "automatic" && <WizardStep title="Automatic roster generation" description="Randomly generated from entered CAWs plus the hidden internal male wrestler pool. This does not change the active run until final activation."><AutomaticRosterPreview draft={draft} validation={validation} onRegenerate={regenerateAutomaticRoster} /><button className="action-button action-primary" disabled={!validation.valid} onClick={() => setStep("preview")}>Preview setup</button></WizardStep>}

      {step === "preview" && <Preview draft={draft} validation={validation} ruleVersion={meta.currentStatus || "Current rule version"} onActivate={requestActivation} />}

      {step === "confirm" && <WizardStep title="Final confirmation" description={"This will replace the current active run. The new run will start at League Year 1, Opening Split, Week 1. This cannot be undone inside the app unless you restored from a backup. Continue?"}>
        <div className="new-run-actions"><button className="action-button action-primary" onClick={activate}>Activate Fresh Run</button><button className="action-button action-secondary" onClick={() => setStep("preview")}>Cancel</button></div>
      </WizardStep>}
    </div>}
  </section>;
}

function WizardStep({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="new-run-step"><h4>{title}</h4><p>{description}</p>{children}</div>; }
function CawList({ caws }: { caws: string[] }) { return <div className="new-run-caws"><strong>CAWs added:</strong> {caws.length ? caws.join(", ") : "None"}</div>; }
function ValidationMessages({ title, messages, tone }: { title: string; messages: string[]; tone: "error" | "warning" }) { return <div className={`new-run-validation ${tone}`} role="status"><strong>{title}</strong><ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul></div>; }
function ValidationPanel({ validation }: { validation: ReturnType<typeof validateNewRunSetupDraft> }) { return <><ValidationMessages title={validation.valid ? "Validation passed" : "Validation errors"} messages={validation.errors.length ? validation.errors : ["Setup has 48 unique filled slots."]} tone={validation.valid ? "warning" : "error"} />{validation.warnings.length > 0 && <ValidationMessages title="Setup warnings" messages={validation.warnings} tone="warning" />}</>; }

function ManualRosterEditor({ draft, updateManualSlot }: { draft: NewRunSetupDraft; updateManualSlot: (league: LeagueName, index: number, value: string) => void }) { return <div className="manual-roster-grid">{LEAGUE_NAMES.map((league) => <fieldset key={league}><legend>{league}</legend>{draft.manualRoster[league].map((name, index) => <label key={`${league}-${index}`}>Seed {index + 1}<input value={name} onChange={(event) => updateManualSlot(league, index, normalizeSetupName(event.target.value))} placeholder={`Seed ${index + 1}`} /></label>)}</fieldset>)}</div>; }

function Preview({ draft, validation, ruleVersion, onActivate }: { draft: NewRunSetupDraft; validation: ReturnType<typeof validateNewRunSetupDraft>; ruleVersion: string; onActivate: () => void }) { return <WizardStep title="Setup preview" description="Review the exact roster seeds before replacing the active run.">
  <div className="new-run-preview"><p><strong>Backup choice:</strong> {draft.backupChoice === "created" ? "Created" : draft.backupChoice === "skipped" ? "Skipped" : draft.backupChoice === "not-available" ? "Not available" : "Not chosen"}</p><p><strong>Start:</strong> League Year 1, Opening Split, Week 1</p><p><strong>Rule Version:</strong> {ruleVersion}</p><p><strong>CAWs added:</strong> {draft.caws.length ? draft.caws.join(", ") : "None"}</p><p><strong>Roster mode:</strong> {draft.rosterMode ?? "Not selected"}</p></div>
  {(draft.rosterMode === "manual" || draft.rosterMode === "automatic") && <div className="new-run-preview-rosters">{LEAGUE_NAMES.map((league) => <div key={league}><h5>{league}</h5><ol>{draft.manualRoster[league].map((name, index) => <li key={`${league}-preview-${index}`}>Seed {index + 1}: {normalizeSetupName(name) || "Missing"}{draft.caws.some((caw) => normalizeSetupName(caw).toLocaleLowerCase() === normalizeSetupName(name).toLocaleLowerCase()) ? " (CAW)" : ""}</li>)}</ol></div>)}</div>}
  <ValidationPanel validation={validation} />
  {draft.rosterMode === "automatic" && <p className="new-run-automatic-note">Total active roster count: {LEAGUE_NAMES.reduce((count, league) => count + draft.manualRoster[league].filter((name) => normalizeSetupName(name)).length, 0)}. Validation status: {validation.valid ? "valid" : "blocked"}.</p>}
  <button className="action-button action-primary" disabled={!validation.valid || !validation.readyForActivation} onClick={onActivate}>Activate Fresh Run</button>
</WizardStep>; }

function AutomaticRosterPreview({ draft, validation, onRegenerate }: { draft: NewRunSetupDraft; validation: ReturnType<typeof validateNewRunSetupDraft>; onRegenerate: () => void }) { return <div><div className="new-run-preview"><p><strong>Total active roster count:</strong> {LEAGUE_NAMES.reduce((count, league) => count + draft.manualRoster[league].filter((name) => normalizeSetupName(name)).length, 0)}</p><p><strong>Validation status:</strong> {validation.valid ? "Valid" : "Blocked"}</p></div><div className="new-run-actions"><button className="action-button action-secondary" onClick={onRegenerate}>Regenerate Random Roster</button></div><div className="new-run-preview-rosters">{LEAGUE_NAMES.map((league) => <div key={league}><h5>{league}</h5><ol>{draft.manualRoster[league].map((name, index) => <li key={`${league}-auto-${index}`}>Seed {index + 1}: {normalizeSetupName(name) || "Missing"}{draft.caws.some((caw) => normalizeSetupName(caw).toLocaleLowerCase() === normalizeSetupName(name).toLocaleLowerCase()) ? " (CAW)" : ""}</li>)}</ol></div>)}</div><ValidationPanel validation={validation} /></div>; }
