import fs from "node:fs";
import path from "node:path";
import { sortAvatarSrcs } from "./avatars.ts";

const FILE = /^avatar_(\d+)\.png$/i;

function avatarDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "public", "avatars"),
    path.join(cwd, "dist", "client", "avatars"),
    path.join(cwd, ".output", "public", "avatars"),
    path.join(cwd, ".output", "public", "client", "avatars"),
  ];
}

/** Every `avatar_N.png` found on disk. */
export function listBuiltInAvatars(): string[] {
  const found = new Set<string>();
  for (const dir of avatarDirs()) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const match = FILE.exec(name);
      if (!match) continue;
      found.add(`/avatars/avatar_${Number(match[1])}.png`);
    }
  }
  return sortAvatarSrcs([...found]);
}
