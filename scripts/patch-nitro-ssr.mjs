#!/usr/bin/env node
/**
 * Nitro's Vercel bundle can emit a circular `_ssr/ssr.mjs` <-> `ssr2.mjs`
 * split that 500s under `vite preview`. Rewrite the barrel to a known-good
 * shape after each production build — but only when that split exists.
 * A later Nitro build may emit a self-contained ssr.mjs with no ssr2.mjs;
 * overwriting that file is what 500s.
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ssrDir = join(root, ".vercel/output/functions/__server.func/_ssr");
const ssrPath = join(ssrDir, "ssr.mjs");
const ssr2Path = join(ssrDir, "ssr2.mjs");

if (existsSync(ssrPath) && existsSync(ssr2Path)) {
  writeFileSync(
    ssrPath,
    `import "../_runtime.mjs";
import { a as getRequest, c as server_exports, i as createServerFn, n as createMiddleware, o as getServerFnById, r as createServerEntry, s as server_default, t as TSS_SERVER_FUNCTION } from "./ssr2.mjs";

function __exportAll(all, no_symbols) {
	let target = {};
	for (var name in all) Object.defineProperty(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
	return target;
}

const ssr_exports = Object.assign(
	Promise.resolve({ default: server_default, t: server_exports }),
	{ default: server_default, t: server_exports },
);

export { getServerFnById as a, __exportAll as c, createServerEntry, server_default as default, TSS_SERVER_FUNCTION as i, createMiddleware as n, getRequest as o, createServerFn as r, ssr_exports as s, server_exports as t };
`,
  );
}

const pgliteDir = join(root, "node_modules/@electric-sql/pglite/dist");
const libsDir = join(root, ".vercel/output/functions/__server.func/_libs");
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm", "initdb.js"]) {
  const from = join(pgliteDir, name);
  const to = join(libsDir, name);
  if (existsSync(from) && existsSync(libsDir) && !existsSync(to)) {
    copyFileSync(from, to);
  }
}
