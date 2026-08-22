import { readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const musicDir = path.join(root, "public", "music");
const output = path.join(musicDir, "library.json");
const supported = new Set([".mp3", ".m4a", ".wav", ".aac", ".ogg"]);

await mkdir(musicDir, { recursive: true });
const files = await readdir(musicDir, { withFileTypes: true });
const tracks = files
  .filter((entry) => entry.isFile() && supported.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => {
    const ext = path.extname(entry.name);
    const base = path.basename(entry.name, ext);
    const name = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return {
      id: `bundled:${entry.name}`,
      name: name || entry.name,
      url: `/music/${encodeURIComponent(entry.name)}`,
      bundled: true,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "sv"));

await writeFile(output, `${JSON.stringify(tracks, null, 2)}\n`, "utf8");
console.log(`Music library: ${tracks.length} bundled track(s)`);
