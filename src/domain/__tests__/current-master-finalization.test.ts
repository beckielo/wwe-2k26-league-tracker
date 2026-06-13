import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { finalizeCurrentMaster } from "../current-master-finalization";
import { CURRENT_MASTER_MARKER } from "../current-master-promotion";

const directories: string[] = [];

type Reply = { status: number; stdout: string; stderr: string };

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
    if (key === "git status --porcelain --untracked-files=all") return { status: 0, stdout: statusOutput, stderr: "" };
    return { status: 0, stdout: "ok", stderr: "" };
  });
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("current master finalization", () => {
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
    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: runner(`?? ${master}\n M README.md\n`) });
    expect(result.message).toContain("README.md");
  });

  it("refuses multiple current-master workbooks", () => {
    const { root, master } = setup({ [`source-docs/[${CURRENT_MASTER_MARKER}] duplicate.xlsx`]: "duplicate" });
    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: runner(`?? ${master}\n`) });
    expect(result.message).toContain("found 2");
  });

  it("stages only current-master workbook paths, uses the week commit message, and removes backups", () => {
    const { root, master } = setup({ "source-docs/[archived-master] old.before-W16.backup": "old" });
    const oldMaster = `source-docs/[${CURRENT_MASTER_MARKER}] WWE_W15_abgeschlossen.xlsx`;
    const run = runner(` D ${oldMaster}\n?? ${master}\n`);
    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: run });
    expect(result).toMatchObject({ ok: true, status: "success" });
    expect(run).toHaveBeenCalledWith("git", ["add", "-A", "--", oldMaster, master], root);
    expect(run).toHaveBeenCalledWith("git", ["commit", "-m", "Update current master workbook to Week 16"], root);
    expect(run).toHaveBeenCalledWith("git", ["push", "origin", "main"], root);
    expect(fs.existsSync(path.join(root, "source-docs/[archived-master] old.before-W16.backup"))).toBe(false);
  });

  it("stops after a failed validation command", () => {
    const { root, master } = setup();
    const run = runner(`?? ${master}\n`, {
      "npm test": { status: 1, stdout: "", stderr: "tests failed" },
    });
    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: run });
    expect(result).toMatchObject({ ok: false, message: "Tests failed." });
    expect(run).not.toHaveBeenCalledWith("npm", ["run", "build"], root);
    expect(run).not.toHaveBeenCalledWith("git", expect.arrayContaining(["commit"]), root);
  });

  it("returns successful structured logs", () => {
    const { root, master } = setup();
    const result = finalizeCurrentMaster(root, 16, { enabled: true, runner: runner(`?? ${master}\n`) });
    expect(result.ok).toBe(true);
    expect(result.logs.map((log) => log.step)).toEqual(["Preflight", "Lint", "Tests", "Build", "Git commit", "Git push"]);
  });
});
