import { NextResponse } from "next/server";

export async function POST(httpRequest: Request) {
  void httpRequest;
  return NextResponse.json({ error: "AI workflows are disabled during the security foundation phase." }, { status: 503 });
}
