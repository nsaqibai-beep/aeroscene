import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const jobId = formData.get("jobId") as string;

    const blob = await put(`generated/${jobId}.mp4`, file, {
      access: "public",
    });

    const { error } = await supabase
      .from("jobs")
      .update({ status: "completed", video_url: blob.url })
      .eq("id", jobId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ videoUrl: blob.url });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
