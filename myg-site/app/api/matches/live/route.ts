import { NextResponse } from "next/server";
import { qLiveMatches } from "@/lib/queries";

export async function GET() {
  const data = await qLiveMatches();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
