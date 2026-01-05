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
      // 1. Start Job
      const res = await fetch("/api/create", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (data.jobId) {
        setStatus("processing");
        // 2. Poll Status (Every 3 seconds)
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
      alert("Error starting job. Check console.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
        AeroScene
      </h1>
      <p className="text-gray-400 mb-8">
        AI Drone Video Generator (Powered by Replicate)
      </p>

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
            <button
              onClick={() => setPreset("orbit")}
              className="flex-1 p-3 rounded-lg border border-gray-800 bg-gray-900"
            >
              Orbit
            </button>
            <button
              onClick={() => setPreset("zoom")}
              className="flex-1 p-3 rounded-lg border border-gray-800 bg-gray-900"
            >
              Zoom
            </button>
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

      {(status === "uploading" || status === "processing") && (
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-400">Generating... (30-60s)</p>
        </div>
      )}

      {status === "failed" && (
        <div className="text-center text-red-500">
          <p>Generation Failed.</p>
          <button
            onClick={() => setStatus("idle")}
            className="underline mt-4 text-white"
          >
            Try Again
          </button>
        </div>
      )}

      {status === "completed" && videoUrl && (
        <div className="w-full max-w-lg">
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full rounded-xl border border-gray-800 bg-gray-900"
          />
          <button
            onClick={() => {
              setStatus("idle");
              setFile(null);
              setVideoUrl(null);
            }}
            className="w-full py-3 mt-4 text-gray-400 border border-gray-800 rounded-lg"
          >
            New Shot
          </button>
        </div>
      )}
    </div>
  );
}
