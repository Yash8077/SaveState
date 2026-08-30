import type { CatalogGame, FeaturedRail } from "./types.ts";

const STEAM_IMG =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

const RAW: ReadonlyArray<readonly [number, string]> = [
  [1245620, "ELDEN RING"],
  [2622380, "ELDEN RING NIGHTREIGN"],
  [1086940, "Baldur's Gate 3"],
  [1091500, "Cyberpunk 2077"],
  [292030, "The Witcher 3: Wild Hunt"],
  [1174180, "Red Dead Redemption 2"],
  [271590, "Grand Theft Auto V"],
  [3240220, "Grand Theft Auto V Enhanced"],
  [2358720, "Black Myth: Wukong"],
  [1623730, "Palworld"],
  [553850, "HELLDIVERS 2"],
  [1145350, "Hades II"],
  [1145360, "Hades"],
  [2379780, "Balatro"],
  [367520, "Hollow Knight"],
  [1030300, "Hollow Knight: Silksong"],
  [413150, "Stardew Valley"],
  [504230, "Celeste"],
  [620, "Portal 2"],
  [400, "Portal"],
  [220, "Half-Life 2"],
  [105600, "Terraria"],
  [294100, "RimWorld"],
  [427520, "Factorio"],
  [892970, "Valheim"],
  [814380, "Sekiro: Shadows Die Twice"],
  [374320, "DARK SOULS III"],
  [570940, "DARK SOULS: REMASTERED"],
  [236430, "DARK SOULS II: Scholar of the First Sin"],
  [1627720, "Lies of P"],
  [1593500, "God of War"],
  [2322010, "God of War Ragnarök"],
  [1817070, "Marvel's Spider-Man Remastered"],
  [2215430, "Ghost of Tsushima DIRECTOR'S CUT"],
  [1888930, "The Last of Us Part I"],
  [2050650, "Resident Evil 4"],
  [2246340, "Monster Hunter Wilds"],
  [582010, "Monster Hunter: World"],
  [990080, "Hogwarts Legacy"],
  [730, "Counter-Strike 2"],
  [570, "Dota 2"],
  [1172470, "Apex Legends"],
  [578080, "PUBG: BATTLEGROUNDS"],
  [1085660, "Destiny 2"],
  [230410, "Warframe"],
  [381210, "Dead by Daylight"],
  [359550, "Tom Clancy's Rainbow Six Siege"],
  [252490, "Rust"],
  [275850, "No Man's Sky"],
  [255710, "Cities: Skylines"],
  [526870, "Satisfactory"],
  [548430, "Deep Rock Galactic"],
  [739630, "Phasmophobia"],
  [945360, "Among Us"],
  [646570, "Slay the Spire"],
  [268910, "Cuphead"],
  [1794680, "Vampire Survivors"],
  [1426210, "It Takes Two"],
  [1966720, "Lethal Company"],
  [3164500, "Schedule I"],
  [1903340, "Clair Obscur: Expedition 33"],
  [1771300, "Kingdom Come: Deliverance II"],
  [379430, "Kingdom Come: Deliverance"],
  [2054970, "Dragon's Dogma 2"],
  [1364780, "Street Fighter 6"],
  [2161700, "Persona 3 Reload"],
  [524220, "NieR: Automata"],
  [632470, "Disco Elysium"],
  [753640, "Outer Wilds"],
  [588650, "Dead Cells"],
  [1649240, "Returnal"],
  [870780, "CONTROL Ultimate Edition"],
  [2197550, "Alan Wake 2"],
  [2124490, "SILENT HILL 2"],
  [1196590, "Resident Evil Village"],
  [1551360, "Forza Horizon 5"],
  [1222670, "The Sims 4"],
  [227300, "Euro Truck Simulator 2"],
  [284160, "BeamNG.drive"],
  [252950, "Rocket League"],
  [289070, "Sid Meier's Civilization VI"],
  [1142710, "Total War: WARHAMMER III"],
  [281990, "Stellaris"],
  [1158310, "Crusader Kings III"],
  [489830, "The Elder Scrolls V: Skyrim Special Edition"],
  [377160, "Fallout 4"],
  [22380, "Fallout: New Vegas"],
  [1716740, "Starfield"],
  [435150, "Divinity: Original Sin 2"],
  [2183900, "Warhammer 40,000: Space Marine 2"],
  [1888160, "ARMORED CORE VI FIRES OF RUBICON"],
  [1887840, "Another Crab's Treasure"],
  [1809540, "Nine Sols"],
  [3527290, "PEAK"],
  [3241660, "R.E.P.O."],
  [2881650, "Content Warning"],
  [2767030, "Marvel Rivals"],
  [2073850, "THE FINALS"],
  [221100, "DayZ"],
  [108600, "Project Zomboid"],
  [322330, "Don't Starve Together"],
  [457140, "Oxygen Not Included"],
  [1366540, "Dyson Sphere Program"],
  [1601580, "Frostpunk 2"],
  [1363080, "Manor Lords"],
  [1172620, "Sea of Thieves"],
  [1203620, "Enshrouded"],
  [39210, "FINAL FANTASY XIV Online"],
  [2694490, "Path of Exile 2"],
  [238960, "Path of Exile"],
  [2344520, "Diablo IV"],
  [899770, "Last Epoch"],
  [1092790, "Inscryption"],
  [391540, "Undertale"],
  [1671210, "DELTARUNE"],
  [1150690, "OMORI"],
  [813230, "ANIMAL WELL"],
  [553420, "TUNIC"],
  [460950, "Katana ZERO"],
  [219150, "Hotline Miami"],
  [48000, "LIMBO"],
  [304430, "INSIDE"],
  [501300, "What Remains of Edith Finch"],
  [546560, "Half-Life: Alyx"],
  [620980, "Beat Saber"],
  [322170, "Geometry Dash"],
  [440, "Team Fortress 2"],
  [550, "Left 4 Dead 2"],
  [4000, "Garry's Mod"],
  [1599340, "Lost Ark"],
  [594650, "Hunt: Showdown"],
  [2142790, "Fields of Mistria"],
  [2669320, "EA SPORTS FC 25"],
];

function toGame(id: number, title: string): CatalogGame {
  const header = `${STEAM_IMG}/${id}/header.jpg`;
  const cover = `${STEAM_IMG}/${id}/library_600x900.jpg`;
  return {
    id: `steam_${id}`,
    steamId: id,
    title,
    coverUrl: cover,
    headerUrl: header,
    capsuleUrl: header,
    platforms: [],
    metacritic: null,
  };
}

export const SEED_GAMES: CatalogGame[] = RAW.map(([id, title]) =>
  toGame(id, title),
);

const INDEX = new Map(SEED_GAMES.map((game) => [game.steamId, game]));

function pick(ids: number[]): CatalogGame[] {
  const games: CatalogGame[] = [];
  for (const id of ids) {
    const game = INDEX.get(id);
    if (game) games.push(game);
  }
  return games;
}

const SERIES: number[][] = [
  [570940, 236430, 374320, 814380, 1245620, 2622380],
  [1145360, 1145350],
  [400, 620],
  [367520, 1030300],
  [1593500, 2322010],
  [271590, 3240220],
  [238960, 2694490],
  [379430, 1771300],
  [582010, 2246340],
  [1817070, 2215430],
];

export function seedRelated(catalogId: string): FeaturedRail[] {
  const match = /^steam_(\d+)$/.exec(catalogId);
  if (!match) return [];
  const steamId = Number(match[1]);
  const chain = SERIES.find((ids) => ids.includes(steamId));
  if (!chain) return [];
  const index = chain.indexOf(steamId);
  const prequels = pick(chain.slice(0, index));
  const sequels = pick(chain.slice(index + 1));
  const rails: FeaturedRail[] = [];
  if (prequels.length) rails.push({ id: "prequel", title: "Prequel", games: prequels });
  if (sequels.length) rails.push({ id: "sequel", title: "Sequel", games: sequels });
  return rails;
}

export const FEATURED_SEED: FeaturedRail[] = [
  {
    id: "popular",
    title: "Popular",
    games: pick([
      1245620, 1086940, 1091500, 292030, 1174180, 271590, 2358720, 1623730,
      553850, 1145350, 2379780, 2622380,
    ]),
  },
  {
    id: "new_releases",
    title: "New releases",
    games: pick([
      1030300, 1903340, 1771300, 2246340, 2622380, 3164500, 3527290, 1145350,
      2767030, 2183900, 3241660, 2881650,
    ]),
  },
  {
    id: "coming_soon",
    title: "Coming soon",
    games: pick([
      2322010, 2197550, 2694490, 1601580, 1363080, 1203620, 1888160, 2054970,
      2161700, 2124490, 1817070, 2215430,
    ]),
  },
  {
    id: "specials",
    title: "Top rated",
    games: pick([
      620, 1145360, 1086940, 292030, 367520, 413150, 504230, 753640, 632470,
      1174180, 814380, 1245620,
    ]),
  },
];

export function playstationSeedRail(): FeaturedRail {
  return {
    id: "playstation",
    title: "PlayStation",
    games: pick([
      553850, 1593500, 2322010, 1888930, 2215430, 1817070, 1649240,
    ]),
  };
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function searchSeed(query: string): CatalogGame[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const scored: { game: CatalogGame; score: number }[] = [];
  for (const game of SEED_GAMES) {
    const title = norm(game.title);
    if (!title.includes(q) && !q.split(" ").every((part) => title.includes(part))) {
      continue;
    }
    let score = 0;
    if (title === q) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.split(" ").some((word) => word.startsWith(q))) score = 60;
    else score = 30;
    scored.push({ game, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 18).map((row) => row.game);
}

export function slimCatalogGame(game: CatalogGame): CatalogGame {
  return {
    id: game.id,
    steamId: game.steamId,
    title: game.title,
    coverUrl: game.coverUrl,
    headerUrl: game.headerUrl,
    capsuleUrl: null,
    platforms: [],
    metacritic: null,
    parentGameId: game.parentGameId ?? null,
    gameType: game.gameType ?? null,
  };
}

export function mergeFeaturedRails(live: FeaturedRail[]): FeaturedRail[] {
  if (!live.length) return FEATURED_SEED;
  const firstId = live[0]?.games[0]?.id ?? "";
  if (firstId.startsWith("igdb_")) return live;
  const popular = FEATURED_SEED[0]!;
  const rest = live.filter((rail) => rail.id !== "top_sellers" && rail.id !== "popular");
  return [popular, ...rest];
}
