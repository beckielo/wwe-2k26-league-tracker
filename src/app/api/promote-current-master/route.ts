import path from "node:path";
import { NextResponse } from "next/server";
import type { WeeklyClosePackage } from "@/domain/weekly-close-exports";
import { promoteCurrentMaster } from "@/domain/current-master-promotion";
import { loadMasterWorkbookBuffer, loadTrackerData } from "@/data/workbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let closePackage: WeeklyClosePackage;
  try {
    closePackage = (await request.json()) as WeeklyClosePackage;
  } catch {
    return NextResponse.json(
      { errors: ["Request body must be a weekly close package."] },
      { status: 400 },
    );
  }

  try {
    const data = loadTrackerData();
    const source = loadMasterWorkbookBuffer();
    const result = promoteCurrentMaster(
      path.join(process.cwd(), "source-docs"),
      {
        workbook: source.buffer,
        sourceFile: source.sourceFile,
        schedule: data.matches,
      },
      closePackage,
    );

    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 422 });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        errors: [
          error instanceof Error
            ? error.message
            : "The current master workbook could not be promoted.",
        ],
      },
      { status: 422 },
    );
  }
}
