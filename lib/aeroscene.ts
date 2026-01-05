import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;

export async function createVideoJob(file: File, preset: string) {
  // 1. Upload Image to Vercel Blob
  const blob = await put(`uploads/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  // 2. Create Job in Supabase
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

  // 3. Start Segmind Job (Stable Video Diffusion)
  // Segmind URL for SVD: https://api.segmind.com/v1/stable-video-diffusion
  const response = await fetch(
    "https://api.segmind.com/v1/stable-video-diffusion",
    {
      method: "POST",
      headers: {
        "x-api-key": SEGMIND_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: blob.url, // Segmind expects 'image' field
        motion_bucket_id: 127,
        cond_aug: 0.02,
        decoding_t: 14,
        frames_per_second: 25,
        sizing_strategy: "maintain_aspect_ratio",
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Segmind Error:", errText);
    await supabase.from("jobs").update({ status: "failed" }).eq("id", job.id);
    throw new Error(`Segmind API Failed: ${errText}`);
  }

  // Segmind returns the IMAGE (binary) directly if it's fast,
  // OR a JSON if it's async. SVD on Segmind is usually synchronous (blocks for 5-10s).
  // BUT Vercel times out in 10s. So we hope it returns fast, or we use their Async endpoint.
  // NOTE: For this free demo, we assume the sync endpoint works within 10s or we handle the timeout.

  // Actually, to be safe on Vercel Free, we should use client-side fetch for Segmind too
  // (like we tried with HF).
  // BUT Segmind allows CORS if configured? No.

  // Better approach: Segmind response is usually binary (video/mp4).
  const videoBlob = await response.blob();
  const savedVideo = await put(`generated/${job.id}.mp4`, videoBlob, {
    access: "public",
  });

  await supabase
    .from("jobs")
    .update({ status: "completed", video_url: savedVideo.url })
    .eq("id", job.id);

  return job;
}

export async function checkJobStatus(jobId: string) {
  // Since we are doing Sync generation above, this is just a DB check
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  return job;
}
