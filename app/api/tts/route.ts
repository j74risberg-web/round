import { list, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

function isValidCode(code: string | null): code is string {
    return !!code && /^[A-Z0-9]{4,12}$/.test(code);
  }

// Text-till-tal med cachning: samma text + samma synk-kod genererar bara
// ljud en gång via OpenAI, sedan återanvänds samma fil för alltid (tills
                                                                    // texten ändras). Detta gör kostnaden i praktiken försumbar.
export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    const text = request.nextUrl.searchParams.get("text");
    const speedRaw = request.nextUrl.searchParams.get("speed");
    const speed = speedRaw ? Number(speedRaw) : 1;
    if (!isValidCode(code) || !text || !text.trim() || !Number.isFinite(speed) || speed < 0.25 || speed > 4) {
          return NextResponse.json({ error: "Ogiltig kod eller text" }, { status: 400 });
        }

    const hash = createHash("sha256").update(`${text.trim().toLowerCase()}|speed:${speed.toFixed(2)}`).digest("hex").slice(0, 24);
    const pathname = `tts/${code}/${hash}.mp3`;

    let match;
    for (let attempt = 0; attempt < 3 && !match; attempt++) {
          if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300));
          const { blobs } = await list({ prefix: pathname, limit: 5 });
          match = blobs.find((blob) => blob.pathname === pathname);
        }

    if (match) {
          return NextResponse.json({ url: match.url, cached: true });
        }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
          return NextResponse.json({ error: "Ingen OPENAI_API_KEY konfigurerad på servern." }, { status: 500 });
        }

    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
          body: JSON.stringify({
                  model: "tts-1-hd",
                  voice: "nova",
                  input: text,
                  response_format: "mp3",
                  speed,
                }),
        });

    if (!ttsResponse.ok) {
          const detail = await ttsResponse.text().catch(() => "");
          return NextResponse.json({ error: "TTS-anropet misslyckades", detail }, { status: 502 });
        }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const blob = await put(pathname, Buffer.from(audioBuffer), {
          access: "public",
          addRandomSuffix: false,
          contentType: "audio/mpeg",
        });

    return NextResponse.json({ url: blob.url, cached: false });
  }
