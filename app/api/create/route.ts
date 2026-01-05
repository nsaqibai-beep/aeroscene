import { NextResponse } from "next/server";
import { createVideoJob } from "@/lib/aeroscene";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const preset = formData.get("preset") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const job = await createVideoJob(file, preset);

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
