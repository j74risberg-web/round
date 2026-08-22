import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ROUND", description: "Intervallträning med egna rundor, timer, musik och röstmeddelanden.", manifest: "/manifest.webmanifest", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" }, appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ROUND" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="sv"><body>{children}</body></html>; }
