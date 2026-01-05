import { NextResponse } from "next/server";
import { checkJobStatus } from "@/lib/aeroscene";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    const job = await checkJobStatus(id);
    return NextResponse.json(job);
  } catch (error) {
    // We log the error so it is 'used' to satisfy the linter
    console.error("Status check failed:", error);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
