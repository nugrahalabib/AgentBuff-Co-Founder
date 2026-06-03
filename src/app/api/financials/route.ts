// POST /api/financials — deterministic financials over the engine (no LLM, no credentials).
// The UI calls this; it returns the exact same FinancialsResult the MCP tool returns. PRD §9.3, §9.6.

import { NextResponse } from "next/server";
import { calculateFinancials, type CalculateFinancialsInput } from "@/server/mcp/tools/calculate-financials";
import { FinancialInputError } from "@/server/engine/financial/index";

export async function POST(req: Request): Promise<Response> {
  let body: CalculateFinancialsInput;
  try {
    body = (await req.json()) as CalculateFinancialsInput;
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }

  try {
    return NextResponse.json(calculateFinancials(body));
  } catch (e) {
    if (e instanceof FinancialInputError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Gagal menghitung keuangan." }, { status: 500 });
  }
}
