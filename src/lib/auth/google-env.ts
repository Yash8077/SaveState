/** Server-only Google OAuth flags. Client secret never leaves the server. */

const read = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

export const googleClientId = read("GOOGLE_CLIENT_ID");
export const googleClientSecret = read("GOOGLE_CLIENT_SECRET");

export const googleAuthEnabled = Boolean(googleClientId && googleClientSecret);

export const APP_AUTH_SCHEME = "savestate";
export const APP_AUTH_CALLBACK = "savestate://callback";

export function nativeAppRedirect(token: string): string {
  return `${APP_AUTH_CALLBACK}?token=${encodeURIComponent(token)}`;
}
