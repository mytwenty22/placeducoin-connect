export type Horaire = { jour: string; valeur: string };

function stripDiacritics(input: string) {
  return Array.from(input.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

function normalize(text: string) {
  return stripDiacritics(text.toLowerCase()).trim();
}

const DAY_KEYS: [string, number][] = [
  ["dimanche", 0],
  ["dim", 0],
  ["lundi", 1],
  ["lun", 1],
  ["mardi", 2],
  ["mar", 2],
  ["mercredi", 3],
  ["mer", 3],
  ["jeudi", 4],
  ["jeu", 4],
  ["vendredi", 5],
  ["ven", 5],
  ["samedi", 6],
  ["sam", 6],
];

function dayIndexFromToken(token: string): number | null {
  for (const [key, idx] of DAY_KEYS) {
    if (token.startsWith(key)) return idx;
  }
  return null;
}

function parseDays(jour: string): Set<number> | null {
  const text = normalize(jour);
  if (text.includes("tous les jours") || text === "tlj" || text === "7j/7") {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }
  const tokens = text.split(/[^a-z]+/).filter(Boolean);
  const indices = tokens.map(dayIndexFromToken).filter((i): i is number => i !== null);
  if (indices.length === 0) return null;

  const start = indices[0]!;
  const end = indices[indices.length - 1]!;
  const days = new Set<number>();
  let i = start;
  for (let step = 0; step < 7; step++) {
    days.add(i);
    if (i === end) break;
    i = (i + 1) % 7;
  }
  return days;
}

function parseTimeRanges(valeur: string): [number, number][] {
  const text = normalize(valeur);
  if (text.includes("ferme")) return [];
  const matches = [...text.matchAll(/(\d{1,2})(?:[h:](\d{2}))?/g)];
  const minutes = matches.map((m) => Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
  const ranges: [number, number][] = [];
  for (let i = 0; i + 1 < minutes.length; i += 2) {
    ranges.push([minutes[i]!, minutes[i + 1]!]);
  }
  return ranges;
}

/**
 * Best-effort "ouvert / fermé" status from free-text horaires like
 * { jour: "Lun – Ven", valeur: "9h – 19h" }. Returns null when the format
 * can't be confidently parsed, so callers can hide the badge rather than
 * show a wrong status.
 */
export function computeOpenStatus(
  horaires: Horaire[],
  now: Date = new Date(),
): "ouvert" | "ferme" | null {
  if (!horaires || horaires.length === 0) return null;
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let matchedToday = false;
  for (const h of horaires) {
    const days = parseDays(h.jour);
    if (!days || !days.has(currentDay)) continue;
    matchedToday = true;
    const ranges = parseTimeRanges(h.valeur);
    if (ranges.some(([start, end]) => currentMinutes >= start && currentMinutes <= end)) {
      return "ouvert";
    }
  }
  return matchedToday ? "ferme" : null;
}
