import type { Station } from "../types";

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchStations(stations: Station[], query: string, limit: number): Station[] {
  const needle = normalize(query);
  if (needle.length === 0) return [];
  const scored = stations
    .map((station) => ({ station, score: scoreMatch(normalize(station.name), needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name, "fr"));
  return scored.slice(0, limit).map((entry) => entry.station);
}

function scoreMatch(haystack: string, needle: string): number {
  if (haystack === needle) return 4;
  if (haystack.startsWith(needle)) return 3;
  if (haystack.split(" ").some((word) => word.startsWith(needle))) return 2;
  if (haystack.includes(needle)) return 1;
  return 0;
}
