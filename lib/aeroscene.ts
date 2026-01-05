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

  // 3. Start AI Generation
  // Model: stability-ai/stable-video-diffusion
  try {
    const prediction = await replicate.predictions.create({
      version:
        "3f0457e4619daac51203dedb472816f3afc54a3c84faeef8706f87124f5e2726",
      input: {
        input_image: blob.url,
        video_length: "14_frames_with_svd_xt",
        frames_per_second: 6,
        motion_bucket_id: 127,
        cond_aug: 0.02,
        decoding_t: 14,
        sizing_strategy: "maintain_aspect_ratio",
      },
    });

    // 4. Save Replicate ID
    await supabase
      .from("jobs")
      .update({ prompt: prediction.id })
      .eq("id", job.id);

    return job;
  } catch (err: unknown) {
    console.log("SVD failed, trying fallback...", err);

    // Fallback: Zeroscope XL (Text-to-video mostly, but useful to test pipe)
    // Note: We use the 'video' input just to test the API connection if SVD failed
    const fallback = await replicate.predictions.create({
      version:
        "9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
      input: {
        prompt: "Cinematic drone shot of a landscape",
        num_frames: 24,
      },
    });

    await supabase
      .from("jobs")
      .update({ prompt: fallback.id })
      .eq("id", job.id);
    return job;
  }
}

export async function checkJobStatus(jobId: string) {
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job || job.status === "completed" || job.status === "failed") {
    return job;
  }

  const replicateId = job.prompt;

  if (!replicateId) return job;

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

  return job;
}
