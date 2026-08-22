import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "round_access";

const PUBLIC_PATHS = [
  "/pin",
  "/api/gate",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.png",
];
const PUBLIC_PREFIXES = ["/_next", "/icons", "/exercises", "/music", "/sounds"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (cookie === "granted") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/pin";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
