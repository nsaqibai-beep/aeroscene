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

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("preset", preset);

    try {
      const res = await fetch("/api/create", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (data.jobId) {
        setStatus("processing");
        // Start polling for status
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/status?id=${data.jobId}`);
            const job = await pollRes.json();

            if (job.status === "completed") {
              setVideoUrl(job.video_url);
              setStatus("completed");
              clearInterval(interval);
            } else if (job.status === "failed") {
              setStatus("failed");
              clearInterval(interval);
            }
          } catch (e) {
            console.error("Polling error", e);
          }
        }, 3000);
      }
    } catch (e) {
      console.error(e);
      setStatus("failed");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
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
            <p className="text-xs text-gray-500 mt-1">JPG or PNG</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Camera Movement</label>
            <div className="flex gap-2">
              {["orbit", "zoom_in", "pan"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`flex-1 p-3 rounded-lg border transition-all text-sm font-medium capitalize ${
                    preset === p
                      ? "border-blue-500 bg-blue-900/50 text-blue-200"
                      : "border-gray-800 bg-gray-900 text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  {p.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Generate Video
          </button>
        </div>
      )}

      {(status === "uploading" || status === "processing") && (
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold">Generating Drone Shot...</h3>
            <p className="text-gray-500">This takes about 30-60 seconds.</p>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">Generation Failed</p>
          <button
            onClick={() => setStatus("idle")}
            className="text-white underline"
          >
            Try Again
          </button>
        </div>
      )}

      {status === "completed" && videoUrl && (
        <div className="w-full max-w-lg space-y-4">
          <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-900 shadow-2xl">
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              className="w-full aspect-video object-cover"
            />
          </div>
          <button
            onClick={() => {
              setStatus("idle");
              setFile(null);
              setVideoUrl(null);
            }}
            className="w-full py-3 text-gray-400 hover:text-white transition-colors border border-gray-800 rounded-lg hover:border-gray-600"
          >
            Create Another Shot
          </button>
        </div>
      )}
    </div>
  );
}
