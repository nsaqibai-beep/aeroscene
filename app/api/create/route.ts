import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    // Upload image
    const blob = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    // Return URL and Token
    return NextResponse.json({
      imageUrl: blob.url,
      hfToken: process.env.HUGGINGFACE_API_KEY,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
