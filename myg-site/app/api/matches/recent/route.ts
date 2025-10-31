import { NextResponse } from "next/server";
import { qRecentMatches } from "@/lib/queries";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 20), 50);
  const data = await qRecentMatches(limit);
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
