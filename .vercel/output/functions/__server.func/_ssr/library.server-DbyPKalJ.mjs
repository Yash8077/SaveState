import { t as STATUSES } from "./library-schema-ui95MHqq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library.server-DbyPKalJ.js
var ENTRY_SELECT = `
  id, catalog_id, title, cover_url, header_url, summary, release_date,
  platforms, genres, metacritic, developers, publishers, screenshots,
  status, score, hours, favorite, notes, started_at, finished_at,
  created_at::text as created_at, updated_at::text as updated_at
`;
function toHours(value) {
	if (value == null) return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}
function asStringArray(value) {
	if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
	return [];
}
function mapEntry(row) {
	const status = STATUSES.includes(row.status) ? row.status : "backlog";
	return {
		id: row.id,
		catalogId: row.catalog_id,
		title: row.title,
		coverUrl: row.cover_url,
		headerUrl: row.header_url,
		summary: row.summary,
		releaseDate: row.release_date,
		platforms: asStringArray(row.platforms),
		genres: asStringArray(row.genres),
		metacritic: row.metacritic,
		developers: asStringArray(row.developers),
		publishers: asStringArray(row.publishers),
		screenshots: asStringArray(row.screenshots),
		status,
		score: row.score,
		hours: toHours(row.hours),
		favorite: Boolean(row.favorite),
		notes: row.notes,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
function jsonbBind(value) {
	return JSON.stringify(value);
}
function encodeLibraryCursor(updatedAt, id) {
	return Buffer.from(JSON.stringify({
		u: updatedAt,
		i: id
	}), "utf8").toString("base64url");
}
function decodeLibraryCursor(raw) {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
		if (typeof parsed.u === "string" && Number.isInteger(parsed.i)) return {
			u: parsed.u,
			i: parsed.i
		};
	} catch {}
	return null;
}
async function listLibraryPage(sql, userId, opts = {}) {
	const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
	const cursor = decodeLibraryCursor(opts.cursor);
	const rows = await sql.query(`select ${ENTRY_SELECT} from game_entries
     where user_id = $1
       and (
         $2::timestamptz is null
         or updated_at < $2::timestamptz
         or (updated_at = $2::timestamptz and id < $3::int)
       )
     order by updated_at desc, id desc
     limit $4`, [
		userId,
		cursor?.u ?? null,
		cursor?.i ?? 0,
		limit + 1
	]);
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);
	const items = page.map(mapEntry);
	const last = page[page.length - 1];
	return {
		items,
		nextCursor: hasMore && last ? encodeLibraryCursor(last.updated_at, last.id) : null
	};
}
async function addToLibraryRow(sql, userId, data) {
	const s = data.snapshot;
	const status = data.status ?? "backlog";
	return mapEntry((await sql.query(`insert into game_entries (
      user_id, catalog_id, title, cover_url, header_url, summary, release_date,
      platforms, genres, metacritic, developers, publishers, screenshots, status, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14, now()
    )
    on conflict (user_id, catalog_id) do update set
      title = excluded.title,
      cover_url = excluded.cover_url,
      header_url = excluded.header_url,
      summary = excluded.summary,
      release_date = excluded.release_date,
      platforms = excluded.platforms,
      genres = excluded.genres,
      metacritic = excluded.metacritic,
      developers = excluded.developers,
      publishers = excluded.publishers,
      screenshots = excluded.screenshots,
      updated_at = now()
    returning ${ENTRY_SELECT}`, [
		userId,
		data.catalogId,
		s.title,
		s.coverUrl,
		s.headerUrl,
		s.summary,
		s.releaseDate,
		jsonbBind(s.platforms),
		jsonbBind(s.genres),
		s.metacritic,
		jsonbBind(s.developers),
		jsonbBind(s.publishers),
		jsonbBind(s.screenshots),
		status
	]))[0]);
}
async function addCustomGameRow(sql, userId, data) {
	const catalogId = `custom_${crypto.randomUUID()}`;
	return mapEntry((await sql.query(`insert into game_entries (
      user_id, catalog_id, title, status, notes, updated_at
    ) values ($1,$2,$3,$4,$5, now())
    returning ${ENTRY_SELECT}`, [
		userId,
		catalogId,
		data.title,
		data.status ?? "backlog",
		data.notes?.trim() || null
	]))[0]);
}
async function updateEntryRow(sql, userId, data) {
	const sets = ["updated_at = now()"];
	const params = [];
	const push = (fragment, value) => {
		params.push(value);
		sets.push(fragment.replace("?", `$${params.length}`));
	};
	if (data.status !== void 0) push("status = ?", data.status);
	if (data.score !== void 0) push("score = ?", data.score);
	if (data.hours !== void 0) push("hours = ?", data.hours);
	if (data.favorite !== void 0) push("favorite = ?", data.favorite);
	if (data.notes !== void 0) push("notes = ?", data.notes);
	if (data.startedAt !== void 0) push("started_at = ?", data.startedAt);
	if (data.finishedAt !== void 0) push("finished_at = ?", data.finishedAt);
	params.push(data.id, userId);
	const idIdx = params.length - 1;
	const userIdx = params.length;
	const rows = await sql.query(`update game_entries set ${sets.join(", ")}
     where id = $${idIdx} and user_id = $${userIdx}
     returning ${ENTRY_SELECT}`, params);
	if (!rows[0]) throw Object.assign(/* @__PURE__ */ new Error("Game not found"), { status: 404 });
	return mapEntry(rows[0]);
}
async function removeEntryRow(sql, userId, id) {
	if (!(await sql.query(`delete from game_entries where id = $1 and user_id = $2 returning id`, [id, userId]))[0]) throw Object.assign(/* @__PURE__ */ new Error("Game not found"), { status: 404 });
	return { ok: true };
}
//#endregion
export { addCustomGameRow, addToLibraryRow, listLibraryPage, removeEntryRow, updateEntryRow };
