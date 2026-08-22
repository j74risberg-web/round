import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

function isValidCode(code: string | null): code is string {
  return !!code && /^[A-Z0-9]{4,12}$/.test(code);
}

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Ogiltig synk-kod" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil skickades" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Filen är för stor (max 15 MB)" }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const pathname = `sync/${code}/audio/${Date.now()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type || "application/octet-stream",
  });

  return NextResponse.json({ url: blob.url });
}
