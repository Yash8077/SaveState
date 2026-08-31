import { sortAvatarSrcs } from "./avatars";

/** Vite inlines this at build, so the picker works even if /api/config has no disk. */
const discovered = import.meta.glob("../../public/avatars/avatar_*.png");

export function bundledAvatarSrcs(): string[] {
  const srcs: string[] = [];
  for (const key of Object.keys(discovered ?? {})) {
    const match = /avatar_(\d+)\.png$/i.exec(key);
    if (match) srcs.push(`/avatars/avatar_${Number(match[1])}.png`);
  }
  return sortAvatarSrcs(srcs);
}
