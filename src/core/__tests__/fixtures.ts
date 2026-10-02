import { Network } from "../network";
import type { NetworkData, Participant } from "../../types";

export const FIXTURE_DATA: NetworkData = {
  generatedAt: "2026-10-02T00:00:00.000Z",
  referenceDate: "20261008",
  lines: {
    "1": { color: "#FFBE00", textColor: "#000000", mode: "metro" },
    "2": { color: "#0055C8", textColor: "#FFFFFF", mode: "metro" },
    A: { color: "#EB2132", textColor: "#FFFFFF", mode: "rer" },
  },
  stations: [
    { id: "alpha", name: "Alpha", lat: 48.86, lon: 2.35, lines: ["1"] },
    { id: "beta", name: "Béta", lat: 48.87, lon: 2.36, lines: ["1", "2"] },
    { id: "gamma", name: "Gamma", lat: 48.9, lon: 2.4, lines: ["A"] },
    { id: "delta", name: "Delta", lat: 48.85, lon: 2.33, lines: ["2"] },
  ],
  candidates: [0, 1, 3],
  matrix: [0, 5, 8, 5, 0, 10, 20, 15, 30, 8, 10, 0],
};

export const fixtureNetwork = (): Network => new Network(FIXTURE_DATA);

export const stationParticipant = (id: string, stationId: string, available = true): Participant => ({
  id,
  name: id.toUpperCase(),
  available,
  location: { kind: "station", stationId },
});

export const addressParticipant = (id: string, lat: number, lon: number, available = true): Participant => ({
  id,
  name: id.toUpperCase(),
  available,
  location: { kind: "address", label: `${id} address`, lat, lon },
});
