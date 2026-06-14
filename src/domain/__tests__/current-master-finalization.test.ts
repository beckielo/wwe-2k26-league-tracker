import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNpmCommand, finalizeCurrentMaster } from "../current-master-finalization";
import { CURRENT_MASTER_MARKER } from "../current-master-promotion";

const directories: string[] = [];

type Reply = { status?: number | null; code?: number | null; stdout: string; stderr: string };

function setup(files: Record<string, string> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finalize-master-"));
  directories.push(root);
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, "source-docs"));
  fs.writeFileSync(path.join(root, "next-env.d.ts"), "generated");
  const master = `source-docs/[${CURRENT_MASTER_MARKER}] WWE_W16_abgeschlossen.xlsx`;
  fs.writeFileSync(path.join(root, master), "workbook");
  for (const [name, value] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), value);
  }
  return { root, master };
}

function runner(statusOutput: string, overrides: Record<string, Reply> = {}) {
  return vi.fn((command: string, args: string[]) => {
    const key = `${command} ${args.join(" ")}`;
    if (overrides[key]) return overrides[key];
    if (key === "git branch --show-current") return { status: 0, stdout: "main\n", stderr: "" };
    if (key === "git status --porcelain=v1 -z --untracked-files=all") {
      return { status: 0, stdout: statusOutput, stderr: "" };
    }
    return { status: 0, stdout: "ok", stderr: "" };
  });
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("current master finalization", () => {
  it.each([
    [["run", "lint"], "npm run lint"],
    [["test"], "npm test"],
    [["run", "build"], "npm run build"],
  ])("builds the Windows npm command %j through cmd.exe", (args, display) => {
    expect(buildNpmCommand(args, "win32")).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `"${display}"`],
      display,
    });
  });

  it("builds npm commands with npm on non-Windows platforms", () => {
    expect(buildNpmCommand(["test"], "linux")).toEqual({
      command: "npm",
      args: ["test"],
      display: "npm test",
    });
  });

  it("uses the platform-safe npm executable for all validation steps", () => {
    const { root, master } = setup();
    const run = runner(`?? ${master}\0`);

    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: run,
      platform: "win32",
    });

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", "\"npm run lint\""], root);
    expect(run).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", "\"npm test\""], root);
    expect(run).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", "\"npm run build\""], root);
    expect(result.logs.find((log) => log.step === "Lint")?.output).toContain("$ npm run lint");
  });

  it("returns a safe response when automation is disabled", () => {
    const { root } = setup();
    const result = finalizeCurrentMaster(root, 16, { enabled: false });
    expect(result).toMatchObject({ ok: false, status: "disabled" });
    expect(result.message).toContain("ALLOW_LOCAL_GIT_AUTOMATION=true");
  });

  it("refuses when the branch is not main and restores next-env.d.ts", () => {
    const { root, master } = setup();
    const run = runner(`?? ${master}\n`, {
      "git branch --show-current": { status: 0, stdout: "feature\n", stderr: "" },
    });
    expect(finalizeCurrentMaster(root, 16, { enabled: true, runner: run })).toMatchObject({ ok: false, status: "failed" });
    expect(run).toHaveBeenCalledWith("git", ["restore", "--", "next-env.d.ts"], root);
  });

  it("refuses unrelated modified files", () => {
    const { root, master } = setup();
    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: runner(`?? ${master}\0 M README.md\0`),
    });
    expect(result.message).toContain("README.md");
  });

  it("refuses multiple current-master workbooks", () => {
    const { root, master } = setup({ [`source-docs/[${CURRENT_MASTER_MARKER}] duplicate.xlsx`]: "duplicate" });
    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: runner(`?? ${master}\0`),
    });
    expect(result.message).toContain("found 2");
  });

  it("accepts and stages the W15 to W16 current-master transition", () => {
    const { root, master } = setup();
    const oldMaster = `source-docs/[${CURRENT_MASTER_MARKER}] WWE_W15_abgeschlossen.xlsx`;
    const run = runner(` D ${oldMaster}\0?? ${master}\0`);
    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: run });
    expect(result).toMatchObject({ ok: true, status: "success" });
    expect(run).toHaveBeenCalledWith("git", ["add", "-A", "--", oldMaster, master], root);
    expect(run).toHaveBeenCalledWith("git", ["commit", "-m", "Update current master workbook to Week 16"], root);
    expect(run).toHaveBeenCalledWith("git", ["push", "origin", "main"], root);
    expect(fs.existsSync(path.join(root, "source-docs/[archived-master] old.before-W16.backup"))).toBe(false);
  });

  it("does not stage next-env.d.ts or archived-master backup files", () => {
    const backup = "source-docs/[archived-master] WWE_W15.before-W16.backup";
    const { root, master } = setup({ [backup]: "old" });
    const oldMaster = `source-docs/[${CURRENT_MASTER_MARKER}] WWE_W15_abgeschlossen.xlsx`;
    const run = runner(` M next-env.d.ts\0 D ${oldMaster}\0?? ${master}\0?? ${backup}\0`);

    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: run });

    expect(result).toMatchObject({ ok: true, status: "success" });
    expect(run).toHaveBeenCalledWith("git", ["add", "-A", "--", oldMaster, master], root);
    expect(run.mock.calls.filter(([command, args]) =>
      command === "git" && args[0] === "add"
    )).toEqual([["git", ["add", "-A", "--", oldMaster, master], root]]);
    expect(fs.existsSync(path.join(root, backup))).toBe(false);
  });

  it.each([
    ["Lint", ["run", "lint"], "lint failed"],
    ["Tests", ["test"], "tests failed"],
    ["Build", ["run", "build"], "build failed"],
  ] as const)("stops after failed %s validation on Windows", (step, args, error) => {
    const { root, master } = setup();
    const run = runner(`?? ${master}\0`, {
      [`cmd.exe /d /s /c "npm ${args.join(" ")}"`]: { status: 1, stdout: "", stderr: error },
    });

    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: run,
      platform: "win32",
    });

    expect(result).toMatchObject({ ok: false, status: "failed", message: `${step} failed.` });
    expect(result.logs.at(-1)).toMatchObject({ step, status: "failed" });
    expect(result.logs.at(-1)?.output).toContain(error);
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["add"]), root);
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["commit"]), root);
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["push"]), root);
  });

  it("uses a command code when status is unavailable", () => {
    const { root, master } = setup();
    const run = runner(`?? ${master}\0`, {
      "npm test": { code: 1, stdout: "", stderr: "tests failed" },
    });

    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: run,
      platform: "linux",
    });

    expect(result).toMatchObject({ ok: false, status: "failed", message: "Tests failed." });
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["commit"]), root);
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["push"]), root);
  });

  it("does not treat a missing command status and code as success", () => {
    const { root, master } = setup();
    const run = runner(`?? ${master}\0`, {
      "npm run lint": { stdout: "", stderr: "command did not report an exit code" },
    });

    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: run,
      platform: "linux",
    });

    expect(result).toMatchObject({ ok: false, status: "failed", message: "Lint failed." });
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["commit"]), root);
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["push"]), root);
  });

  it("returns successful structured logs", () => {
    const { root, master } = setup();
    const result = finalizeCurrentMaster(root, 16, {
      enabled: true,
      runner: runner(`?? ${master}\0`),
    });
    expect(result.ok).toBe(true);
    expect(result.logs.map((log) => log.step)).toEqual(["Preflight", "Lint", "Tests", "Build", "Git commit", "Git push"]);
  });
});
