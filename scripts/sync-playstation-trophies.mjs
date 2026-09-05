import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophies,
} from "psn-api";

const baseUrl = (process.env.SAVESTATE_URL ?? "").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET ?? "";
const npsso = process.env.PSN_NPSSO ?? "";
const refreshToken = process.env.PSN_REFRESH_TOKEN ?? "";

if (!baseUrl || !cronSecret) {
  throw new Error("SAVESTATE_URL and CRON_SECRET are required");
}

if (!npsso && !refreshToken) {
  throw new Error("PSN_NPSSO or PSN_REFRESH_TOKEN is required");
}

async function getAuthorization() {
  if (refreshToken) {
    try {
      return await exchangeRefreshTokenForAuthTokens(refreshToken);
    } catch (error) {
      if (!npsso) throw error;
      console.warn("Refresh token failed; falling back to NPSSO exchange");
    }
  }

  const accessCode = await exchangeNpssoForAccessCode(npsso);
  return exchangeAccessCodeForAuthTokens(accessCode);
}

async function postCatalog(platform, trophyTitleId, trophySetVersion, trophies) {
  const response = await fetch(`${baseUrl}/api/trophies/catalog`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({
      platform,
      trophyTitleId,
      trophySetVersion,
      trophies,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `SaveState catalog POST failed (${response.status}): ${text}`,
    );
  }

  return response.json();
}

const targetsResponse = await fetch(`${baseUrl}/api/trophies/catalog`, {
  headers: { "x-cron-secret": cronSecret },
});

if (!targetsResponse.ok) {
  throw new Error(`SaveState catalog GET failed: ${targetsResponse.status}`);
}

const { npCommunicationIds = [] } = await targetsResponse.json();

const targetsToSync = npCommunicationIds.filter(
  (target) => !target.catalogSynced,
);

if (!targetsToSync.length) {
  console.log("No uncached trophy catalogs to sync.");
  process.exit(0);
}

console.log(
  `Found ${targetsToSync.length} uncached trophy catalog target(s).`,
);

const authorization = await getAuthorization();

for (const target of targetsToSync) {
  const service = target.platform === "ps5" ? "trophy2" : "trophy";

  console.log(
    `Fetching ${target.npCommunicationId} (${target.platform})`,
  );

  try {
    const response = await getTitleTrophies(
      { accessToken: authorization.accessToken },
      target.npCommunicationId,
      "all",
      {
        npServiceName: service,
        limit: 2000,
      },
    );

    const trophies = (response.trophies ?? []).map((trophy) => ({
      trophyId: trophy.trophyId,
      trophyGroupId: trophy.trophyGroupId ?? null,
      trophyType: trophy.trophyType ?? null,
      trophyName: trophy.trophyName ?? null,
      trophyDetail: trophy.trophyDetail ?? null,
      trophyIconUrl: trophy.trophyIconUrl ?? null,
      trophyHidden: trophy.trophyHidden ?? null,
      trophyProgressTargetValue:
        trophy.trophyProgressTargetValue ?? null,
    }));

    if (!trophies.length) {
      throw new Error(
        `No trophies returned for ${target.npCommunicationId}`,
      );
    }

    const result = await postCatalog(
      target.platform,
      target.npCommunicationId,
      response.trophySetVersion ?? null,
      trophies,
    );

    console.log(
      `Updated ${result.updated} trophy records for ${target.npCommunicationId}`,
    );
  } catch (error) {
    console.error(`Failed ${target.npCommunicationId}:`, error);
    process.exitCode = 1;
  }
}
