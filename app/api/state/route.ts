import { list, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

function isValidCode(code: string | null): code is string {
  return !!code && /^[A-Z0-9]{4,12}$/.test(code);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Ogiltig synk-kod" }, { status: 400 });
  }

  const pathname = `sync/${code}/state.json`;

  // list() can lag briefly right after a put() due to eventual consistency,
  // so retry a couple of times before concluding there's really nothing there.
  let match;
  for (let attempt = 0; attempt < 3 && !match; attempt++) {
    if (attempt > 0) await sleep(300);
    const { blobs } = await list({ prefix: pathname, limit: 5 });
    match = blobs.find((blob) => blob.pathname === pathname);
  }

  if (!match) {
    return NextResponse.json({ found: false });
  }

  const response = await fetch(match.url, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ found: false });
  }
  const data = await response.json();
  return NextResponse.json({ found: true, data, updatedAt: match.uploadedAt });
}

export async function POST(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Ogiltig synk-kod" }, { status: 400 });
  }

  const body = await request.json();
  const pathname = `sync/${code}/state.json`;
  await put(pathname, JSON.stringify(body), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
