"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "processing" | "completed" | "failed"
  >("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState("orbit");

  // We need to fetch the token securely (or just use a proxy route, but for demo we can try direct if CORS allows,
  // or use a specialized route that streams).
  // BETTER APPROACH FOR VERCEL FREE:
  // 1. Upload image to Vercel Blob (Server)
  // 2. Return the Blob URL to Client
  // 3. Client calls Hugging Face directly (Bypassing Vercel 10s timeout)
  // 4. Client saves result to DB (Server)

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");

    try {
      // Step 1: Upload Image to Vercel Blob via our API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preset", preset);

      // We need a new simple route just for uploading
      const uploadRes = await fetch("/api/upload-only", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      const { imageUrl, jobId, hfToken } = await uploadRes.json();

      setStatus("processing");

      // Step 2: Client calls Hugging Face (No timeout limit here!)
      const hfResponse = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`, // We pass this from server temporarily
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: imageUrl }),
        }
      );

      if (!hfResponse.ok) throw new Error("HF API Failed");
      const videoBlob = await hfResponse.blob();

      // Step 3: Upload the result back to our server
      const videoFile = new File([videoBlob], "video.mp4", {
        type: "video/mp4",
      });
      const resultFormData = new FormData();
      resultFormData.append("file", videoFile);
      resultFormData.append("jobId", jobId);

      const saveRes = await fetch("/api/save-video", {
        method: "POST",
        body: resultFormData,
      });
      const saveData = await saveRes.json();

      setVideoUrl(saveData.videoUrl);
      setStatus("completed");
    } catch (e) {
      console.error(e);
      setStatus("failed");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
        AeroScene
      </h1>
      <p className="text-gray-400 mb-8">AI Drone Video Generator</p>

      {status === "idle" && (
        <div className="w-full max-w-md space-y-6">
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-900 hover:border-gray-500 transition-colors cursor-pointer relative group">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <UploadCloud className="w-12 h-12 mb-3 text-gray-500 group-hover:text-white transition-colors" />
            <p className="font-medium">
              {file ? file.name : "Tap to upload photo"}
            </p>
          </div>

          <div className="flex gap-2">
            {["orbit", "zoom_in", "pan"].map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`flex-1 p-3 rounded-lg border transition-all text-sm font-medium capitalize ${
                  preset === p
                    ? "border-blue-500 bg-blue-900/50"
                    : "border-gray-800 bg-gray-900"
                }`}
              >
                {p.replace("_", " ")}
              </button>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 disabled:opacity-50"
          >
            Generate Video
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold">Generating...</h3>
            <p className="text-gray-500">
              Wait ~30-60s (Do not close this tab)
            </p>
          </div>
        </div>
      )}

      {status === "completed" && videoUrl && (
        <div className="w-full max-w-lg space-y-4">
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full rounded-xl border border-gray-800 bg-gray-900"
          />
          <button
            onClick={() => setStatus("idle")}
            className="w-full py-3 text-gray-400 border border-gray-800 rounded-lg"
          >
            Create Another
          </button>
        </div>
      )}
      {status === "failed" && (
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">
            Failed. (Free AI servers are busy)
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="text-white underline"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
