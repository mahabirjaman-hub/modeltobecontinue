import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,
      reference_id = "f2aed07c91614db28daaaa849150cc6e",
    } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const apiKey = process.env.FISH_AUDIO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "FISH_AUDIO_API_KEY is not configured",
      });
    }

    const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: "s2.1-pro-free",
      },
      body: JSON.stringify({
        text: text.trim(),
        reference_id,
        format: "mp3",
      }),
    });

    if (!fishResponse.ok) {
      const errorText = await fishResponse.text();

      console.error(
        "Fish Audio error:",
        fishResponse.status,
        errorText
      );

      return res.status(fishResponse.status).json({
        error: errorText || "Fish Audio request failed",
      });
    }

    const audioBuffer = Buffer.from(
      await fishResponse.arrayBuffer()
    );

    return res.status(200).json({
      audio: audioBuffer.toString("base64"),
      format: "mp3",
      contentType: "audio/mpeg",
    });
  } catch (error: any) {
    console.error("Fish TTS error:", error);

    return res.status(500).json({
      error: error?.message || "Fish Audio TTS failed",
    });
  }
}
