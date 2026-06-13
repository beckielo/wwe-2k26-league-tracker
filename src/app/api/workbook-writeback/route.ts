import { NextResponse } from "next/server";
import type { WeeklyClosePackage } from "@/domain/weekly-close-exports";
import { createWorkbookWriteback } from "@/domain/workbook-writeback";
import { loadMasterWorkbookBuffer, loadTrackerData } from "@/data/workbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let closePackage: WeeklyClosePackage;
  try {
    closePackage = (await request.json()) as WeeklyClosePackage;
  } catch {
    return NextResponse.json({ errors: ["Request body must be a weekly close package."] }, { status: 400 });
  }

  const data = loadTrackerData();
  const source = loadMasterWorkbookBuffer();
  const result = createWorkbookWriteback(
    { workbook: source.buffer, sourceFile: source.sourceFile, schedule: data.matches },
    closePackage,
  );

  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 422 });

  return new Response(Buffer.from(result.workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
