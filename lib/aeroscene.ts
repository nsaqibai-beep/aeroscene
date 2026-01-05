import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";
import Replicate from "replicate";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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

  // 3. Start AI Generation (Replicate - Stable Video Diffusion)
  // Using a stable version hash for SVD XT
  const prediction = await replicate.predictions.create({
    version: "3f0457e4619daac51203dedb472816f3afc54a3c84faeef8706f87124f5e2726",
    input: {
      input_image: blob.url,
      video_length: "14_frames_with_svd_xt",
      sizing_strategy: "maintain_aspect_ratio",
      frames_per_second: 6,
      motion_bucket_id: 127,
      cond_aug: 0.02,
      decoding_t: 14,
    },
  });

  // 4. Save Replicate ID to DB (store in 'prompt' column as a hack to save space)
  await supabase
    .from("jobs")
    .update({ prompt: prediction.id })
    .eq("id", job.id);

  return job;
}

export async function checkJobStatus(jobId: string) {
  // 1. Get Job from DB
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job || job.status === "completed" || job.status === "failed") {
    return job;
  }

  // 2. Check Replicate Status
  const replicateId = job.prompt;
  const prediction = await replicate.predictions.get(replicateId);

  if (prediction.status === "succeeded") {
    const videoUrl = prediction.output;

    await supabase
      .from("jobs")
      .update({ status: "completed", video_url: videoUrl })
      .eq("id", jobId);

    return { ...job, status: "completed", video_url: videoUrl };
  } else if (
    prediction.status === "failed" ||
    prediction.status === "canceled"
  ) {
    await supabase.from("jobs").update({ status: "failed" }).eq("id", jobId);
    return { ...job, status: "failed" };
  }

  return job; // Still processing
}
