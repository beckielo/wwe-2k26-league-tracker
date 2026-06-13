import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CURRENT_MASTER_MARKER } from "./current-master-promotion";

export const FINALIZATION_STEPS = [
  "Preflight",
  "Lint",
  "Tests",
  "Build",
  "Git commit",
  "Git push",
] as const;

export type FinalizationStep = (typeof FINALIZATION_STEPS)[number];
export type StepLog = {
  step: FinalizationStep;
  status: "success" | "failed" | "skipped";
  output: string;
};
export type FinalizationResult = {
  ok: boolean;
  status: "success" | "disabled" | "nothing-to-commit" | "failed";
  message: string;
  logs: StepLog[];
};

type CommandResult = { status: number; stdout: string; stderr: string };
type CommandRunner = (command: string, args: string[], cwd: string) => CommandResult;

const runCommand: CommandRunner = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
};

function outputOf(result: CommandResult): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
}

function restoreNextEnv(projectRoot: string, runner: CommandRunner): void {
  runner("git", ["restore", "--", "next-env.d.ts"], projectRoot);
}

function currentMasterFiles(sourceDir: string): string[] {
  return fs.readdirSync(sourceDir).filter((name) =>
    name.includes(CURRENT_MASTER_MARKER) && name.toLowerCase().endsWith(".xlsx"),
  );
}

function removePromotionBackups(sourceDir: string): void {
  for (const name of fs.readdirSync(sourceDir)) {
    if (name.includes("[archived-master]") || name.endsWith(".backup")) {
      fs.rmSync(path.join(sourceDir, name), { force: true, recursive: true });
    }
  }
}

function parseStatusPaths(status: string): string[] {
  return status.split("\n").filter(Boolean).flatMap((line) => {
    const value = line.slice(3);
    return value.includes(" -> ") ? value.split(" -> ") : [value];
  });
}

function isAllowedWorkbookPath(filePath: string): boolean {
  return filePath.startsWith("source-docs/") &&
    filePath.includes(CURRENT_MASTER_MARKER) &&
    filePath.toLowerCase().endsWith(".xlsx");
}

export function finalizeCurrentMaster(
  projectRoot: string,
  week: number,
  options: { enabled?: boolean; runner?: CommandRunner } = {},
): FinalizationResult {
  const enabled = options.enabled ?? process.env.ALLOW_LOCAL_GIT_AUTOMATION === "true";
  const runner = options.runner ?? runCommand;
  const logs: StepLog[] = [];
  const disabledMessage =
    "Git finalization is disabled. Set ALLOW_LOCAL_GIT_AUTOMATION=true before starting npm run dev.";

  if (!enabled) return { ok: false, status: "disabled", message: disabledMessage, logs };
  if (!Number.isInteger(week) || week < 1) {
    return { ok: false, status: "failed", message: "A valid promoted week is required.", logs };
  }

  const fail = (step: FinalizationStep, message: string, output = message): FinalizationResult => {
    logs.push({ step, status: "failed", output });
    return { ok: false, status: "failed", message, logs };
  };

  const sourceDir = path.join(projectRoot, "source-docs");
  if (!fs.existsSync(path.join(projectRoot, ".git")) || !fs.existsSync(sourceDir)) {
    return fail("Preflight", "Git finalization can only run from the local project repository.");
  }

  restoreNextEnv(projectRoot, runner);
  removePromotionBackups(sourceDir);

  const branch = runner("git", ["branch", "--show-current"], projectRoot);
  if (branch.status !== 0 || branch.stdout.trim() !== "main") {
    return fail("Preflight", "Finalization requires the current git branch to be main.", outputOf(branch));
  }

  const masters = currentMasterFiles(sourceDir);
  if (masters.length !== 1) {
    return fail("Preflight", `Expected exactly one current-master workbook, found ${masters.length}.`);
  }
  if (!new RegExp(`(?:^|[^0-9])W${week}(?:[^0-9]|$)`, "i").test(masters[0])) {
    return fail("Preflight", `The current-master filename does not contain promoted Week ${week}.`);
  }

  const status = runner("git", ["status", "--porcelain", "--untracked-files=all"], projectRoot);
  if (status.status !== 0) return fail("Preflight", "Could not inspect repository changes.", outputOf(status));
  const changedPaths = parseStatusPaths(status.stdout).filter((file) => file !== "next-env.d.ts");
  const unrelated = changedPaths.filter((file) => !isAllowedWorkbookPath(file));
  if (unrelated.length > 0) {
    return fail("Preflight", `Refusing to finalize with unrelated changes: ${unrelated.join(", ")}`);
  }
  logs.push({ step: "Preflight", status: "success", output: `Validated ${masters[0]} on main.` });

  for (const [step, args] of [
    ["Lint", ["run", "lint"]],
    ["Tests", ["test"]],
    ["Build", ["run", "build"]],
  ] as const) {
    const result = runner("npm", [...args], projectRoot);
    restoreNextEnv(projectRoot, runner);
    if (result.status !== 0) return fail(step, `${step} failed.`, outputOf(result));
    logs.push({ step, status: "success", output: outputOf(result) || `${step} passed.` });
  }

  const workbookChanges = changedPaths.filter(isAllowedWorkbookPath);
  if (workbookChanges.length === 0) {
    logs.push({ step: "Git commit", status: "skipped", output: "Nothing to commit." });
    logs.push({ step: "Git push", status: "skipped", output: "Push skipped because there was nothing to commit." });
    return { ok: true, status: "nothing-to-commit", message: "The promoted workbook is already committed. Nothing to commit.", logs };
  }

  const stage = runner("git", ["add", "-A", "--", ...workbookChanges], projectRoot);
  if (stage.status !== 0) return fail("Git commit", "Could not stage the current-master workbook.", outputOf(stage));
  const commitMessage = `Update current master workbook to Week ${week}`;
  const commit = runner("git", ["commit", "-m", commitMessage], projectRoot);
  if (commit.status !== 0) return fail("Git commit", "Git commit failed.", outputOf(commit));
  logs.push({ step: "Git commit", status: "success", output: commitMessage });

  const push = runner("git", ["push", "origin", "main"], projectRoot);
  if (push.status !== 0) return fail("Git push", "Git push failed.", outputOf(push));
  logs.push({ step: "Git push", status: "success", output: outputOf(push) || "Pushed to origin main." });
  return { ok: true, status: "success", message: `Week ${week} was saved to GitHub.`, logs };
}
