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

type CommandResult = {
  status?: number | null;
  code?: number | null;
  stdout: string;
  stderr: string;
};
type CommandRunner = (command: string, args: string[], cwd: string) => CommandResult;
type NpmCommand = { command: "npm" | "cmd.exe"; args: string[]; display: string };

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

function commandSucceeded(result: CommandResult): boolean {
  const exitCode = result.status ?? result.code;
  return exitCode === 0;
}

export function buildNpmCommand(
  args: string[],
  platform: NodeJS.Platform = process.platform,
): NpmCommand {
  const display = `npm ${args.join(" ")}`;
  if (platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "npm.cmd", ...args], display };
  }
  return { command: "npm", args, display };
}

function commandOutput(command: NpmCommand, result: CommandResult): string {
  return [`$ ${command.display}`, outputOf(result)].filter(Boolean).join("\n");
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
  const records = status.split("\0");
  const paths: string[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;

    const statusCode = record.slice(0, 2);
    paths.push(record.slice(3));
    if (statusCode.includes("R") || statusCode.includes("C")) {
      const originalPath = records[index + 1];
      if (originalPath) paths.push(originalPath);
      index += 1;
    }
  }

  return paths;
}

function isAllowedWorkbookPath(filePath: string): boolean {
  return filePath.startsWith("source-docs/") &&
    filePath.includes(CURRENT_MASTER_MARKER) &&
    filePath.toLowerCase().endsWith(".xlsx");
}

function isPromotionBackupPath(filePath: string): boolean {
  return filePath.startsWith("source-docs/") &&
    !filePath.includes(CURRENT_MASTER_MARKER) &&
    (filePath.includes("[archived-master]") || filePath.endsWith(".backup"));
}

export function finalizeCurrentMaster(
  projectRoot: string,
  week: number,
  options: { enabled?: boolean; runner?: CommandRunner; platform?: NodeJS.Platform } = {},
): FinalizationResult {
  const enabled = options.enabled ?? process.env.ALLOW_LOCAL_GIT_AUTOMATION === "true";
  const runner = options.runner ?? runCommand;
  const platform = options.platform ?? process.platform;
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
  if (!commandSucceeded(branch) || branch.stdout.trim() !== "main") {
    return fail("Preflight", "Finalization requires the current git branch to be main.", outputOf(branch));
  }

  const masters = currentMasterFiles(sourceDir);
  if (masters.length !== 1) {
    return fail("Preflight", `Expected exactly one current-master workbook, found ${masters.length}.`);
  }
  if (!new RegExp(`(?:^|[^0-9])W${week}(?:[^0-9]|$)`, "i").test(masters[0])) {
    return fail("Preflight", `The current-master filename does not contain promoted Week ${week}.`);
  }

  const status = runner(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    projectRoot,
  );
  if (!commandSucceeded(status)) return fail("Preflight", "Could not inspect repository changes.", outputOf(status));
  const changedPaths = parseStatusPaths(status.stdout).filter(
    (file) => file !== "next-env.d.ts" && !isPromotionBackupPath(file),
  );
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
    const command = buildNpmCommand([...args], platform);
    const result = runner(command.command, command.args, projectRoot);
    restoreNextEnv(projectRoot, runner);
    const output = commandOutput(command, result);
    if (!commandSucceeded(result)) return fail(step, `${step} failed.`, output);
    logs.push({ step, status: "success", output: output || `${step} passed.` });
  }

  const workbookChanges = changedPaths.filter(isAllowedWorkbookPath);
  if (workbookChanges.length === 0) {
    logs.push({ step: "Git commit", status: "skipped", output: "Nothing to commit." });
    logs.push({ step: "Git push", status: "skipped", output: "Push skipped because there was nothing to commit." });
    return { ok: true, status: "nothing-to-commit", message: "The promoted workbook is already committed. Nothing to commit.", logs };
  }

  const stage = runner("git", ["add", "-A", "--", ...workbookChanges], projectRoot);
  if (!commandSucceeded(stage)) return fail("Git commit", "Could not stage the current-master workbook.", outputOf(stage));
  const commitMessage = `Update current master workbook to Week ${week}`;
  const commit = runner("git", ["commit", "-m", commitMessage], projectRoot);
  if (!commandSucceeded(commit)) return fail("Git commit", "Git commit failed.", outputOf(commit));
  logs.push({ step: "Git commit", status: "success", output: commitMessage });

  const push = runner("git", ["push", "origin", "main"], projectRoot);
  if (!commandSucceeded(push)) return fail("Git push", "Git push failed.", outputOf(push));
  logs.push({ step: "Git push", status: "success", output: outputOf(push) || "Pushed to origin main." });
  return { ok: true, status: "success", message: `Week ${week} was saved to GitHub.`, logs };
}
