import { describe, expect, it } from "vitest";
import { availableParticipants, rankStations, topResults } from "../ranking";
import { fixtureNetwork, stationParticipant } from "./fixtures";

describe("availableParticipants", () => {
  it("keeps only checked participants", () => {
    const participants = [stationParticipant("a", "alpha"), stationParticipant("b", "beta", false)];
    expect(availableParticipants(participants).map((participant) => participant.id)).toEqual(["a"]);
  });
});

describe("rankStations", () => {
  const network = fixtureNetwork();
  const alpha = stationParticipant("a", "alpha");
  const delta = stationParticipant("d", "delta");

  it("returns nothing without available participants", () => {
    expect(rankStations(network, [stationParticipant("a", "alpha", false)], "max")).toEqual([]);
  });

  it("computes per-participant times for every candidate", () => {
    const ranked = rankStations(network, [alpha, delta], "max");
    const beta = ranked.find((entry) => entry.station.id === "beta")!;
    expect(beta.times).toEqual([
      { participantId: "a", minutes: 5 },
      { participantId: "d", minutes: 10 },
    ]);
    expect(beta.max).toBe(10);
    expect(beta.total).toBe(15);
    expect(beta.spread).toBe(5);
  });

  it("sorts by maximum time, then total, then name", () => {
    const ranked = rankStations(network, [alpha, delta], "max");
    expect(ranked.map((entry) => entry.station.id)).toEqual(["alpha", "delta", "beta"]);
  });

  it("sorts by spread when asked", () => {
    const ranked = rankStations(network, [alpha, delta], "spread");
    expect(ranked[0].station.id).toBe("beta");
  });

  it("ignores unavailable participants", () => {
    const ranked = rankStations(network, [alpha, stationParticipant("d", "delta", false)], "max");
    expect(ranked[0].station.id).toBe("alpha");
    expect(ranked[0].times).toHaveLength(1);
  });

  it("skips candidates unreachable by a participant", () => {
    expect(rankStations(network, [stationParticipant("x", "missing")], "max")).toEqual([]);
  });
});

describe("topResults", () => {
  const network = fixtureNetwork();
  const ranked = rankStations(
    network,
    [stationParticipant("a", "alpha"), stationParticipant("d", "delta")],
    "max",
  );

  it("pins the chosen station and excludes it from the alternatives", () => {
    const { chosen, alternatives } = topResults(ranked, "beta");
    expect(chosen?.station.id).toBe("beta");
    expect(alternatives.map((entry) => entry.station.id)).toEqual(["alpha", "delta"]);
  });

  it("returns no chosen station when the id is unknown", () => {
    const { chosen, alternatives } = topResults(ranked, "missing");
    expect(chosen).toBeNull();
    expect(alternatives).toHaveLength(3);
  });
});
