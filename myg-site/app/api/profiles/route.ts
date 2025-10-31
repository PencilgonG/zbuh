import { NextResponse } from "next/server";
import { qProfiles } from "@/lib/queries";

export async function GET() {
  const data = await qProfiles();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
