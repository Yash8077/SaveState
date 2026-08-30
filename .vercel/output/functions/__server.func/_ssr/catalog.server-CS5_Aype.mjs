import { i as slimCatalogGame, n as mergeFeaturedRails, r as searchSeed } from "./catalog-seed-GyIvdhCE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/catalog.server-CS5_Aype.js
var FETCH_MS$1 = 4e3;
var IMG = "https://images.igdb.com/igdb/image/upload";
var token = null;
var tokenInflight = null;
function credentials() {
	const id = process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID || "";
	const secret = process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET || "";
	if (!id || !secret) return null;
	return {
		id,
		secret
	};
}
function isIgdbReady() {
	return credentials() != null;
}
function igdbCatalogId(id) {
	return `igdb_${id}`;
}
function parseIgdbId(catalogId) {
	const match = /^igdb_(\d+)$/.exec(catalogId);
	return match ? Number(match[1]) : null;
}
function img(id, size) {
	return id ? `${IMG}/t_${size}/${id}.jpg` : null;
}
function quote(value) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}
function unixDate(unix) {
	if (!unix) return null;
	return (/* @__PURE__ */ new Date(unix * 1e3)).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC"
	});
}
function names(list) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const item of list ?? []) {
		const label = item.abbreviation || item.name;
		if (!label || seen.has(label)) continue;
		seen.add(label);
		out.push(label);
	}
	return out;
}
function companies(list, role) {
	const out = [];
	for (const row of list ?? []) {
		const name = row.company?.name;
		if (!name) continue;
		if (role === "developer" && row.developer) out.push(name);
		if (role === "publisher" && row.publisher) out.push(name);
	}
	return out;
}
function toGame(game, coverSize = "cover_big") {
	if (!game.id || !game.name) return null;
	const cover = img(game.cover?.image_id, coverSize);
	const header = img(game.screenshots?.[0]?.image_id, "screenshot_med") || cover;
	const rating = game.aggregated_rating;
	return {
		id: igdbCatalogId(game.id),
		steamId: null,
		title: game.name,
		coverUrl: cover,
		headerUrl: header,
		capsuleUrl: cover,
		platforms: names(game.platforms).slice(0, 6),
		metacritic: typeof rating === "number" && Number.isFinite(rating) ? Math.round(rating) : null
	};
}
function tokenStillValid(row, clientId) {
	return row.clientId === clientId && row.exp > Date.now() + 6e4;
}
async function readTokenFromDb(clientId) {
	try {
		const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
		const row = (await (await getSql()).query(`select access_token, (extract(epoch from expires_at) * 1000) as exp_ms
       from igdb_token_cache where client_id = $1`, [clientId]))[0];
		if (!row?.access_token) return null;
		const exp = Number(row.exp_ms);
		if (!Number.isFinite(exp) || exp <= Date.now() + 6e4) return null;
		return {
			access: row.access_token,
			clientId,
			exp
		};
	} catch {
		return null;
	}
}
async function writeTokenToDb(row) {
	try {
		const { getSql } = await import("./db-DSuCMacl.mjs").then((n) => n.t).then((n) => n.t);
		await (await getSql()).query(`insert into igdb_token_cache (client_id, access_token, expires_at, updated_at)
       values ($1, $2, to_timestamp($3::double precision / 1000.0), now())
       on conflict (client_id) do update set
         access_token = excluded.access_token,
         expires_at = excluded.expires_at,
         updated_at = now()`, [
			row.clientId,
			row.access,
			row.exp
		]);
	} catch {}
}
async function fetchTwitchToken(creds) {
	const body = new URLSearchParams({
		client_id: creds.id,
		client_secret: creds.secret,
		grant_type: "client_credentials"
	});
	const res = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		signal: AbortSignal.timeout(FETCH_MS$1)
	});
	if (!res.ok) throw new Error(`IGDB auth failed (${res.status})`);
	const data = await res.json();
	if (!data.access_token) throw new Error("IGDB auth failed");
	const expires = Math.max(60, Number(data.expires_in) || 3600);
	return {
		access: data.access_token,
		clientId: creds.id,
		exp: Date.now() + (expires - 120) * 1e3
	};
}
async function getToken() {
	const creds = credentials();
	if (!creds) throw new Error("IGDB is not configured");
	if (token && tokenStillValid(token, creds.id)) return token;
	if (tokenInflight) return tokenInflight;
	tokenInflight = (async () => {
		const cached = await readTokenFromDb(creds.id);
		if (cached && tokenStillValid(cached, creds.id)) {
			token = cached;
			return cached;
		}
		const fresh = await fetchTwitchToken(creds);
		token = fresh;
		writeTokenToDb(fresh);
		return fresh;
	})().finally(() => {
		tokenInflight = null;
	});
	return tokenInflight;
}
var ticks = [];
async function throttle() {
	const now = Date.now();
	ticks = ticks.filter((t) => now - t < 1e3);
	if (ticks.length >= 4) {
		await new Promise((r) => setTimeout(r, 1e3 - (now - ticks[0])));
		ticks = ticks.filter((t) => Date.now() - t < 1e3);
	}
	ticks.push(Date.now());
}
function retryDelay(attempt) {
	const base = 250 * 2 ** (attempt - 1);
	return base + Math.random() * base;
}
async function igdb(path, body) {
	let lastError = null;
	for (let attempt = 0; attempt <= 2; attempt++) {
		if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelay(attempt)));
		const auth = await getToken();
		await throttle();
		const res = await fetch(`https://api.igdb.com/v4/${path}`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Client-ID": auth.clientId,
				Authorization: `Bearer ${auth.access}`
			},
			body,
			signal: AbortSignal.timeout(FETCH_MS$1)
		});
		if (res.ok) return await res.json();
		lastError = /* @__PURE__ */ new Error(`IGDB request failed (${res.status})`);
		if (res.status !== 429 && res.status < 500) throw lastError;
	}
	throw lastError ?? /* @__PURE__ */ new Error("IGDB request failed");
}
var SEARCH_FIELDS = "name, cover.image_id";
var CARD_FIELDS = "name, cover.image_id, first_release_date, aggregated_rating";
var DETAIL_FIELDS = `${CARD_FIELDS}, platforms.abbreviation, platforms.name, genres.name, slug, summary, url, screenshots.image_id, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, websites.url, websites.category`;
async function searchIgdb(query) {
	const q = query.replace(/[\n\r]/g, " ").trim().slice(0, 80);
	if (q.length < 2) return [];
	const rows = await igdb("games", `search ${quote(q)}; fields ${SEARCH_FIELDS}; where version_parent = null; limit 12;`);
	const seen = /* @__PURE__ */ new Set();
	const games = [];
	for (const row of rows ?? []) {
		const game = toGame(row, "cover_big");
		if (!game || seen.has(game.id)) continue;
		seen.add(game.id);
		games.push(slimCatalogGame(game));
	}
	return games;
}
async function fetchIgdbDetails(catalogId) {
	const id = parseIgdbId(catalogId);
	if (!id) return null;
	const game = (await igdb("games", `fields ${DETAIL_FIELDS};
     where id = ${id}; limit 1;`))?.[0];
	if (!game) return null;
	const base = toGame(game, "cover_big");
	if (!base) return null;
	const shots = (game.screenshots ?? []).map((s) => img(s.image_id, "screenshot_med")).filter((src) => Boolean(src)).slice(0, 8);
	const site = game.websites?.find((w) => w.category === 1)?.url || game.url || null;
	const release = game.first_release_date ?? 0;
	return {
		...base,
		summary: game.summary ?? "",
		releaseDate: unixDate(game.first_release_date),
		comingSoon: Boolean(release && release * 1e3 > Date.now()),
		genres: names(game.genres),
		developers: companies(game.involved_companies, "developer"),
		publishers: companies(game.involved_companies, "publisher"),
		screenshots: shots,
		website: site,
		headerUrl: shots[0] || base.headerUrl
	};
}
async function fetchIgdbFeatured() {
	const now = Math.floor(Date.now() / 1e3);
	const day = 86400;
	const rows = await igdb("multiquery", `
query games "trending" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & aggregated_rating_count > 30;
  sort aggregated_rating_count desc;
  limit 12;
};
query games "new" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & first_release_date > ${now - 90 * day} & first_release_date <= ${now};
  sort first_release_date desc;
  limit 12;
};
query games "soon" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & first_release_date > ${now} & first_release_date < ${now + 180 * day};
  sort first_release_date asc;
  limit 12;
};
query games "top" {
  fields ${CARD_FIELDS};
  where cover != null & version_parent = null & category = 0 & aggregated_rating > 86 & aggregated_rating_count > 40;
  sort aggregated_rating desc;
  limit 12;
};
`);
	const titles = {
		trending: "Trending",
		new: "New releases",
		soon: "Coming soon",
		top: "Top rated"
	};
	const rails = [];
	for (const block of rows ?? []) {
		const id = block.name || "";
		const games = [];
		const seen = /* @__PURE__ */ new Set();
		for (const row of block.result ?? []) {
			const game = toGame(row, "cover_big");
			if (!game || seen.has(game.id)) continue;
			seen.add(game.id);
			games.push(slimCatalogGame(game));
		}
		if (!games.length) continue;
		rails.push({
			id,
			title: titles[id] || id,
			games
		});
	}
	return rails;
}
if (credentials() && !process.env.NODE_TEST_CONTEXT) getToken().catch(() => {});
var UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36";
var STEAM_IMG = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
var featuredCache = null;
var FEATURED_TTL_MS = 18e5;
var SEARCH_TTL_MS = 6e5;
var DETAILS_TTL_MS = 18e5;
var FETCH_MS = 4e3;
var searchCache = /* @__PURE__ */ new Map();
var detailsCache = /* @__PURE__ */ new Map();
var searchInflight = /* @__PURE__ */ new Map();
var detailsInflight = /* @__PURE__ */ new Map();
var featuredInflight = null;
async function steamGet(url) {
	const res = await fetch(url, {
		headers: {
			"User-Agent": UA,
			Accept: "application/json"
		},
		signal: AbortSignal.timeout(FETCH_MS)
	});
	if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
	return res.json();
}
function platformsFromFlags(flags) {
	const out = [];
	if (flags?.windows || flags?.windows_available) out.push("Windows");
	if (flags?.mac || flags?.mac_available) out.push("macOS");
	if (flags?.linux || flags?.linux_available) out.push("Linux");
	return out;
}
function steamCatalogId(steamId) {
	return `steam_${steamId}`;
}
function parseSteamId(catalogId) {
	const match = /^steam_(\d+)$/.exec(catalogId);
	return match ? Number(match[1]) : null;
}
function artUrl(steamId, fallback) {
	return fallback || `${STEAM_IMG}/${steamId}/header.jpg`;
}
function fromSearchItem(item) {
	if (!item.id || !item.name) return null;
	if (item.type && item.type !== "app") return null;
	const metascore = item.metascore ? Number(item.metascore) : NaN;
	const art = artUrl(item.id, item.tiny_image);
	return {
		id: steamCatalogId(item.id),
		steamId: item.id,
		title: item.name,
		coverUrl: art,
		headerUrl: art,
		capsuleUrl: item.tiny_image ?? null,
		platforms: platformsFromFlags(item.platforms),
		metacritic: Number.isFinite(metascore) ? metascore : null
	};
}
function fromFeaturedItem(item) {
	if (!item.id || !item.name) return null;
	const art = artUrl(item.id, item.header_image ?? item.large_capsule_image ?? item.small_capsule_image);
	return {
		id: steamCatalogId(item.id),
		steamId: item.id,
		title: item.name,
		coverUrl: art,
		headerUrl: art,
		capsuleUrl: item.small_capsule_image ?? item.large_capsule_image ?? null,
		platforms: platformsFromFlags(item),
		metacritic: null
	};
}
function trimCache(cache, max) {
	while (cache.size > max) {
		const first = cache.keys().next().value;
		if (!first) break;
		cache.delete(first);
	}
}
function dedupeGames(games) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const game of games) {
		if (!game.id || seen.has(game.id)) continue;
		seen.add(game.id);
		out.push(slimCatalogGame(game));
	}
	return out;
}
async function searchSteam(query) {
	const q = query.trim();
	if (q.length < 2) return [];
	const data = await steamGet(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&cc=us&l=english`);
	const games = [];
	for (const item of data.items ?? []) {
		const game = fromSearchItem(item);
		if (!game) continue;
		games.push(game);
		if (games.length >= 18) break;
	}
	return dedupeGames(games);
}
async function runSearchWith(query, sources) {
	const seed = () => dedupeGames(sources.searchSeed(query));
	if (sources.igdbReady()) {
		const steamP = sources.searchSteam(query).catch(() => []);
		try {
			const igdbGames = dedupeGames(await sources.searchIgdb(query));
			if (igdbGames.length) return igdbGames;
		} catch {}
		const steamGames = dedupeGames(await steamP);
		if (steamGames.length) return steamGames;
		return seed();
	}
	try {
		const steamGames = await sources.searchSteam(query);
		if (steamGames.length) return dedupeGames(steamGames);
	} catch {}
	return seed();
}
async function runSearch(query) {
	return runSearchWith(query, {
		igdbReady: isIgdbReady,
		searchIgdb,
		searchSteam,
		searchSeed
	});
}
async function searchCatalog(query) {
	const q = query.trim();
	if (q.length < 2) return [];
	const key = q.toLowerCase();
	const now = Date.now();
	const hit = searchCache.get(key);
	if (hit && now - hit.at < SEARCH_TTL_MS) return hit.games;
	const pending = searchInflight.get(key);
	if (hit) {
		if (!pending) {
			const run = runSearch(q).then((games) => {
				trimCache(searchCache, 200);
				searchCache.set(key, {
					at: Date.now(),
					games
				});
				return games;
			}).finally(() => {
				searchInflight.delete(key);
			});
			searchInflight.set(key, run);
		}
		return hit.games;
	}
	if (pending) return pending;
	const run = runSearch(q).then((games) => {
		trimCache(searchCache, 200);
		searchCache.set(key, {
			at: Date.now(),
			games
		});
		return games;
	}).finally(() => {
		searchInflight.delete(key);
	});
	searchInflight.set(key, run);
	return run;
}
async function fetchSteamDetails(catalogId) {
	const steamId = parseSteamId(catalogId);
	if (!steamId) return null;
	const payload = (await steamGet(`https://store.steampowered.com/api/appdetails?appids=${steamId}&l=english&filters=basic,developers,publishers,genres,screenshots,metacritic`))[String(steamId)];
	if (!payload?.success || !payload.data) return null;
	const app = payload.data;
	const screenshots = (app.screenshots ?? []).map((shot) => shot.path_thumbnail ?? shot.path_full).filter((src) => Boolean(src)).slice(0, 6);
	const art = artUrl(steamId, app.header_image);
	return {
		id: steamCatalogId(steamId),
		steamId,
		title: app.name ?? `App ${steamId}`,
		coverUrl: art,
		headerUrl: art,
		capsuleUrl: app.header_image ?? null,
		platforms: platformsFromFlags(app.platforms),
		metacritic: app.metacritic?.score ?? null,
		summary: app.short_description ?? "",
		releaseDate: app.release_date?.date ?? null,
		comingSoon: Boolean(app.release_date?.coming_soon),
		genres: (app.genres ?? []).map((g) => g.description).filter((g) => Boolean(g)),
		developers: app.developers ?? [],
		publishers: app.publishers ?? [],
		screenshots,
		website: app.website ?? null
	};
}
async function runDetails(catalogId) {
	if (catalogId.startsWith("igdb_")) try {
		return await fetchIgdbDetails(catalogId);
	} catch {
		return null;
	}
	return fetchSteamDetails(catalogId);
}
async function fetchCatalogDetails(catalogId) {
	const hit = detailsCache.get(catalogId);
	if (hit && Date.now() - hit.at < DETAILS_TTL_MS) return hit.data;
	const pending = detailsInflight.get(catalogId);
	if (hit) {
		if (!pending) {
			const run = runDetails(catalogId).then((data) => {
				trimCache(detailsCache, 200);
				detailsCache.set(catalogId, {
					at: Date.now(),
					data
				});
				return data;
			}).finally(() => {
				detailsInflight.delete(catalogId);
			});
			detailsInflight.set(catalogId, run);
		}
		return hit.data;
	}
	if (pending) return pending;
	const run = runDetails(catalogId).then((data) => {
		trimCache(detailsCache, 200);
		detailsCache.set(catalogId, {
			at: Date.now(),
			data
		});
		return data;
	}).finally(() => {
		detailsInflight.delete(catalogId);
	});
	detailsInflight.set(catalogId, run);
	return run;
}
async function fetchSteamFeatured() {
	const data = await steamGet("https://store.steampowered.com/api/featuredcategories/?cc=us&l=english");
	const wanted = [
		{
			key: "top_sellers",
			fallback: "Trending"
		},
		{
			key: "new_releases",
			fallback: "New releases"
		},
		{
			key: "coming_soon",
			fallback: "Coming soon"
		},
		{
			key: "specials",
			fallback: "On sale"
		}
	];
	const rails = [];
	for (const { key, fallback } of wanted) {
		const block = data[key];
		const games = [];
		for (const item of block?.items ?? []) {
			const game = fromFeaturedItem(item);
			if (!game) continue;
			games.push(game);
			if (games.length >= 12) break;
		}
		const unique = dedupeGames(games);
		if (!unique.length) continue;
		rails.push({
			id: key,
			title: fallback,
			games: unique
		});
	}
	return rails;
}
async function refreshFeaturedWith(sources) {
	let rails = [];
	if (sources.igdbReady()) {
		const steamP = sources.fetchSteamFeatured().catch(() => []);
		try {
			const igdbRails = await sources.fetchIgdbFeatured();
			if (igdbRails.length) rails = igdbRails;
		} catch {}
		if (!rails.length) rails = await steamP;
	} else try {
		rails = await sources.fetchSteamFeatured();
	} catch {
		rails = [];
	}
	rails = mergeFeaturedRails(rails);
	featuredCache = {
		at: Date.now(),
		rails
	};
	return rails;
}
async function refreshFeatured() {
	return refreshFeaturedWith({
		igdbReady: isIgdbReady,
		fetchIgdbFeatured,
		fetchSteamFeatured
	});
}
async function fetchFeaturedRails() {
	if (featuredCache && Date.now() - featuredCache.at < FEATURED_TTL_MS) return featuredCache.rails;
	if (featuredCache) {
		featuredInflight ??= refreshFeatured().finally(() => {
			featuredInflight = null;
		});
		return featuredCache.rails;
	}
	if (featuredInflight) return featuredInflight;
	featuredInflight = refreshFeatured().finally(() => {
		featuredInflight = null;
	});
	return featuredInflight;
}
function catalogJson(data, maxAgeSec) {
	return new Response(JSON.stringify(data), { headers: {
		"content-type": "application/json; charset=utf-8",
		"cache-control": `public, max-age=${maxAgeSec}, stale-while-revalidate=${maxAgeSec * 6}`
	} });
}
if (!process.env.NODE_TEST_CONTEXT) fetchFeaturedRails().catch(() => {});
//#endregion
export { catalogJson, fetchCatalogDetails, fetchFeaturedRails, searchCatalog };
