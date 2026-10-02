import { describe, expect, it } from "vitest";
import { EMPTY_STATE, MAX_PARTICIPANTS, decodeState, encodeState } from "../url-state";
import type { AppState, Participant } from "../../types";

const station = (id: string, stationId: string, available = true): Participant => ({
  id,
  name: id.toUpperCase(),
  available,
  location: { kind: "station", stationId },
});

const address = (id: string, label: string, lat: number, lon: number, available = true): Participant => ({
  id,
  name: id.toUpperCase(),
  available,
  location: { kind: "address", label, lat, lon },
});

const withSequentialIds = (state: AppState): AppState => ({
  ...state,
  participants: state.participants.map((participant, index) => ({ ...participant, id: `p${index + 1}` })),
});

describe("url state", () => {
  const state: AppState = {
    participants: [
      station("alice", "IDFM:71673"),
      address("bob", "10 Rue Oberkampf 75011 Paris", 48.86305, 2.36852, false),
      { ...station("chloé", "IDFM:71517"), photoUrl: "https://example.com/chloé.jpg" },
    ],
    chosenStationId: "IDFM:474151",
    sortMode: "spread",
  };

  it("round-trips a full state through the hash", () => {
    expect(decodeState(`#${encodeState(state)}`)).toEqual(withSequentialIds(state));
  });

  it("round-trips negative coordinates", () => {
    const overseas: AppState = {
      ...EMPTY_STATE,
      participants: [address("dom", "Pointe-à-Pitre", 16.24125, -61.53302)],
    };
    expect(decodeState(`#${encodeState(overseas)}`)).toEqual(withSequentialIds(overseas));
  });

  it("encodes the empty state as an empty hash", () => {
    expect(encodeState(EMPTY_STATE)).toBe("");
    expect(decodeState("")).toEqual(EMPTY_STATE);
    expect(decodeState("#")).toEqual(EMPTY_STATE);
  });

  it("falls back to the empty state on garbage", () => {
    expect(decodeState("#v=not-a-real-payload")).toEqual(EMPTY_STATE);
    expect(decodeState("#s=not-a-real-payload")).toEqual(EMPTY_STATE);
    expect(decodeState("#other=1")).toEqual(EMPTY_STATE);
  });

  it("caps the number of participants", () => {
    const many: AppState = {
      ...EMPTY_STATE,
      participants: Array.from({ length: MAX_PARTICIPANTS + 3 }, (_, i) => station(`p${i}`, "IDFM:71673")),
    };
    expect(decodeState(`#${encodeState(many)}`).participants).toHaveLength(MAX_PARTICIPANTS);
  });

  it("keeps the hash short", () => {
    const three: AppState = {
      ...EMPTY_STATE,
      participants: [
        { ...station("alice", "IDFM:71673"), name: "Alice" },
        { ...address("bob", "10 Rue Oberkampf 75011 Paris", 48.86305, 2.36852), name: "Bob" },
        { ...station("chloé", "IDFM:71517"), name: "Chloé" },
      ],
    };
    expect(encodeState(three).length).toBeLessThan(110);
    const ten: AppState = {
      ...EMPTY_STATE,
      participants: Array.from({ length: MAX_PARTICIPANTS }, (_, i) =>
        address(
          `participant-${i}`,
          `${i + 1} Rue de la Roquette 75011 Paris`,
          48.86 + i / 1000,
          2.35 + i / 1000,
        ),
      ),
    };
    expect(encodeState(ten).length).toBeLessThan(400);
  });

  it("still decodes links produced by the legacy format", () => {
    const legacy =
      "#s=N4IgbiBcCMA0IAcoG1QEsogIbRPAdpgIIA2aAxgKZ7ZRwgDOmAkgCIBiAspAOzQBsPAMwgAvrHSYARgCYahSCABCAeyk0sUAAzwAZpgAWAFyMIGkAPQXKADywBbBCUoA6civsWpalwCsEAOY0JJjQWgAEAEoArpThAPJSlABOANYOCLrhPACsWtDQ4QAKWMloTPAAnlAALAAcLnX8Qlo58DZQMi5C-HU5MqIAuvDkLBzcfDnQPDQqmAwIyZRYACZiQA";
    expect(decodeState(legacy)).toEqual({
      participants: [
        { id: "a1", name: "Alice", available: true, location: { kind: "station", stationId: "IDFM:71673" } },
        {
          id: "b2",
          name: "Bob",
          available: false,
          location: { kind: "address", label: "10 Rue Oberkampf 75011 Paris", lat: 48.86305, lon: 2.36852 },
          photoUrl: "https://example.com/bob.jpg",
        },
      ],
      chosenStationId: "IDFM:71517",
      sortMode: "spread",
    });
  });
});
