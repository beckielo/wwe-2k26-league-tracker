import { NextResponse } from "next/server";
import { finalizeCurrentMaster } from "@/domain/current-master-finalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { week?: number };
  try {
    body = (await request.json()) as { week?: number };
  } catch {
    return NextResponse.json({ ok: false, status: "failed", message: "A valid JSON request is required.", logs: [] }, { status: 400 });
  }

  const result = finalizeCurrentMaster(process.cwd(), body.week ?? Number.NaN);
  const status = result.ok ? 200 : result.status === "disabled" ? 403 : 422;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
