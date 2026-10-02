import { describe, expect, it } from "vitest";
import { normalize, searchStations } from "../station-search";
import { FIXTURE_DATA } from "./fixtures";

describe("normalize", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalize("Châtelet - Les Halles")).toBe("chatelet les halles");
  });
});

describe("searchStations", () => {
  it("matches without accents", () => {
    expect(searchStations(FIXTURE_DATA.stations, "beta", 5).map((station) => station.id)).toEqual(["beta"]);
  });

  it("ranks prefix matches before substring matches", () => {
    const stations = [
      { id: "1", name: "Nation", lat: 0, lon: 0, lines: [] },
      { id: "2", name: "Porte de la Nation", lat: 0, lon: 0, lines: [] },
      { id: "3", name: "Internationale", lat: 0, lon: 0, lines: [] },
    ];
    expect(searchStations(stations, "nation", 5).map((station) => station.id)).toEqual(["1", "2", "3"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchStations(FIXTURE_DATA.stations, "  ", 5)).toEqual([]);
  });

  it("honours the limit", () => {
    expect(searchStations(FIXTURE_DATA.stations, "a", 2)).toHaveLength(2);
  });
});
