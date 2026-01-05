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
    const preset = formData.get("preset") as string;

    const blob = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        image_url: blob.url,
        status: "processing",
        motion_preset: preset,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      imageUrl: blob.url,
      jobId: job.id,
      apiKey: process.env.SEGMIND_API_KEY,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
