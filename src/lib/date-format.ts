function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoToDmy(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function dmyToIso(raw: string | null | undefined): string {
  const match = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})$/.exec(
    (raw ?? "").trim(),
  );
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const max = new Date(year, month, 0).getDate();
  if (day > max) return "";
  return `${year}-${pad(month)}-${pad(day)}`;
}
