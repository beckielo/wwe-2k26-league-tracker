import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { WeeklyClosePackage } from "./weekly-close-exports";
import {
  createWorkbookWriteback,
  LOG_SHEET,
  RESULTS_SHEET,
  STANDINGS_SHEET,
  type WorkbookWritebackBaseline,
} from "./workbook-writeback";

export const CURRENT_MASTER_MARKER = "source-docs-current-master";

export type CurrentMasterPromotionResult =
  | {
      ok: true;
      filename: string;
      backupFilename: string;
      week: number;
    }
  | { ok: false; errors: string[] };

function currentMasterCandidates(sourceDir: string): string[] {
  return fs
    .readdirSync(sourceDir)
    .filter(
      (name) =>
        name.includes(CURRENT_MASTER_MARKER) &&
        name.toLowerCase().endsWith(".xlsx"),
    );
}

function validatePromotedWorkbook(
  workbookBytes: Uint8Array,
  closePackage: WeeklyClosePackage,
): string[] {
  const errors: string[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(workbookBytes, { type: "array", cellDates: false });
  } catch {
    return ["Generated workbook could not be reopened for validation."];
  }

  for (const sheetName of [RESULTS_SHEET, STANDINGS_SHEET, LOG_SHEET]) {
    if (!workbook.Sheets[sheetName]) {
      errors.push(`Generated workbook is missing ${sheetName}.`);
    }
  }

  if (
    workbook.Sheets[RESULTS_SHEET] &&
    XLSX.utils.sheet_to_json(workbook.Sheets[RESULTS_SHEET]).length !==
      closePackage.results.length
  ) {
    errors.push("Generated workbook has incomplete confirmed results.");
  }
  if (
    workbook.Sheets[STANDINGS_SHEET] &&
    XLSX.utils.sheet_to_json(workbook.Sheets[STANDINGS_SHEET]).length !==
      closePackage.standings.length
  ) {
    errors.push("Generated workbook has incomplete standings.");
  }
  if (
    workbook.Sheets[LOG_SHEET] &&
    XLSX.utils.sheet_to_json(workbook.Sheets[LOG_SHEET]).length < 1
  ) {
    errors.push("Generated workbook has an incomplete writeback log.");
  }

  return errors;
}

function backupName(sourceName: string, week: number): string {
  const base = sourceName
    .replace(`[${CURRENT_MASTER_MARKER}]`, "[archived-master]")
    .replace(/\.xlsx$/i, "");
  return `${base}.before-W${week}.${Date.now()}.backup`;
}

export function promoteCurrentMaster(
  sourceDir: string,
  baseline: WorkbookWritebackBaseline,
  closePackage: WeeklyClosePackage,
  generatedAt = new Date().toISOString(),
): CurrentMasterPromotionResult {
  const candidates = currentMasterCandidates(sourceDir);
  if (candidates.length !== 1) {
    return {
      ok: false,
      errors: [
        `Expected exactly one current master workbook, found ${candidates.length}.`,
      ],
    };
  }

  const sourceName = candidates[0];
  if (sourceName !== baseline.sourceFile) {
    return {
      ok: false,
      errors: ["The uniquely identified current master does not match the workbook baseline."],
    };
  }

  const writeback = createWorkbookWriteback(
    {
      workbook: baseline.workbook.slice(),
      sourceFile: baseline.sourceFile,
      schedule: structuredClone(baseline.schedule),
    },
    structuredClone(closePackage),
    generatedAt,
  );
  if (!writeback.ok) return writeback;

  const validationErrors = validatePromotedWorkbook(
    writeback.workbook,
    closePackage,
  );
  if (validationErrors.length > 0) {
    return { ok: false, errors: validationErrors };
  }

  const targetName = `[${CURRENT_MASTER_MARKER}] WWE_2K26_Liga_System_LY2_Opening_W${closePackage.week}_abgeschlossen.xlsx`;
  const oldPath = path.join(sourceDir, sourceName);
  const targetPath = path.join(sourceDir, targetName);
  const backupFilename = backupName(sourceName, closePackage.week);
  const backupPath = path.join(sourceDir, backupFilename);
  const temporaryPath = path.join(
    sourceDir,
    `.promote-W${closePackage.week}-${process.pid}-${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, Buffer.from(writeback.workbook), { flag: "wx" });
    fs.renameSync(oldPath, backupPath);
    try {
      fs.renameSync(temporaryPath, targetPath);
    } catch (error) {
      fs.renameSync(backupPath, oldPath);
      throw error;
    }

    const promotedCandidates = currentMasterCandidates(sourceDir);
    if (
      promotedCandidates.length !== 1 ||
      promotedCandidates[0] !== targetName
    ) {
      fs.rmSync(targetPath, { force: true });
      fs.renameSync(backupPath, oldPath);
      return {
        ok: false,
        errors: ["Promotion did not leave exactly one current master workbook."],
      };
    }
  } catch {
    fs.rmSync(temporaryPath, { force: true });
    return {
      ok: false,
      errors: ["The current master workbook could not be promoted safely."],
    };
  }

  return {
    ok: true,
    filename: targetName,
    backupFilename,
    week: closePackage.week,
  };
}
