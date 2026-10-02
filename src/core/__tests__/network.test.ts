import { describe, expect, it } from "vitest";
import { haversineMeters, walkMinutes } from "../network";
import { addressParticipant, fixtureNetwork, stationParticipant } from "./fixtures";

describe("Network", () => {
  const network = fixtureNetwork();

  it("reads travel minutes from the flat matrix", () => {
    expect(network.travelMinutes(0, 1)).toBe(5);
    expect(network.travelMinutes(2, 3)).toBe(30);
    expect(network.travelMinutes(3, 3)).toBe(0);
  });

  it("rejects non-candidate destinations", () => {
    expect(() => network.travelMinutes(0, 2)).toThrow();
  });

  it("returns the nearest stations sorted by walking time", () => {
    const accesses = network.nearestStations(48.86, 2.35, 2);
    expect(accesses.map((access) => access.stationIndex)).toEqual([0, 1]);
    expect(accesses[0].walkMinutes).toBe(0);
    expect(accesses[1].walkMinutes).toBeGreaterThan(accesses[0].walkMinutes);
  });

  it("resolves a station participant to a single zero-walk access", () => {
    const resolved = network.resolve(stationParticipant("a", "beta"));
    expect(resolved.accesses).toEqual([{ stationIndex: 1, walkMinutes: 0 }]);
    expect(resolved.farFromNetwork).toBe(false);
  });

  it("resolves an unknown station to no access", () => {
    expect(network.resolve(stationParticipant("a", "missing")).accesses).toEqual([]);
  });

  it("resolves an address participant to its nearest stations", () => {
    const resolved = network.resolve(addressParticipant("a", 48.861, 2.351));
    expect(resolved.accesses).toHaveLength(4);
    expect(resolved.accesses[0].stationIndex).toBe(0);
    expect(resolved.farFromNetwork).toBe(false);
  });

  it("flags addresses far from any station", () => {
    expect(network.resolve(addressParticipant("a", 49.5, 2.35)).farFromNetwork).toBe(true);
  });
});

describe("walkMinutes", () => {
  it("applies the detour factor at 4.5 km/h", () => {
    expect(walkMinutes(750)).toBeCloseTo(13, 0);
  });
});

describe("haversineMeters", () => {
  it("measures roughly one kilometre per 0.009 degree of latitude", () => {
    expect(haversineMeters(48.85, 2.35, 48.859, 2.35)).toBeCloseTo(1000, -2);
  });
});
