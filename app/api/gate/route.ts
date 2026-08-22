import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "round_access";
const SIX_MONTHS = 60 * 60 * 24 * 180;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const expected = process.env.ROUND_PIN;

  if (!expected) {
    return NextResponse.json({ error: "Ingen PIN-kod är konfigurerad på servern." }, { status: 500 });
  }
  if (pin !== expected) {
    return NextResponse.json({ error: "Fel PIN-kod." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "granted", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SIX_MONTHS,
  });
  return response;
}
