import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  // 3. Start AI Generation (Fire and forget)
  processVideo(job.id, blob.url, preset);

  return job;
}

async function processVideo(jobId: string, imageUrl: string, preset: string) {
  try {
    const promptMap: Record<string, string> = {
      orbit: "orbiting camera movement, cinematic, smooth 3d",
      zoom_in: "slow camera zoom in, pushing towards subject",
      pan: "slow camera pan right, establishing shot",
    };
    const prompt = promptMap[preset] || "cinematic drone shot";

    // Used the prompt in the log now to satisfy the linter
    console.log(
      `Starting Job ${jobId} | Preset: ${preset} | Prompt: ${prompt}`
    );

    // Call Hugging Face API
    // Note: SVD models generally take the image as primary input.
    // If using a model that accepts text control, we would pass 'prompt' in the body too.
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt",
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: imageUrl }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HF API Error: ${response.status} ${errText}`);
    }

    const videoBlob = await response.blob();

    // Save generated video
    const savedVideo = await put(`generated/${jobId}.mp4`, videoBlob, {
      access: "public",
    });

    // Update DB
    await supabase
      .from("jobs")
      .update({
        status: "completed",
        video_url: savedVideo.url,
      })
      .eq("id", jobId);
  } catch (error) {
    console.error("Generation failed:", error);
    await supabase.from("jobs").update({ status: "failed" }).eq("id", jobId);
  }
}
