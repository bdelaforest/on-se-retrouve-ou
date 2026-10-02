import { describe, expect, it } from "vitest";
import { EMPTY_STATE, MAX_PARTICIPANTS, decodeState, encodeState } from "../url-state";
import type { AppState } from "../../types";
import { addressParticipant, stationParticipant } from "./fixtures";

describe("url state", () => {
  const state: AppState = {
    participants: [stationParticipant("a", "alpha"), addressParticipant("b", 48.86305, 2.36852, false)],
    chosenStationId: "beta",
    sortMode: "spread",
  };

  it("round-trips a participant photo url", () => {
    const withPhoto: AppState = {
      ...EMPTY_STATE,
      participants: [{ ...stationParticipant("a", "alpha"), photoUrl: "https://example.com/a.jpg" }],
    };
    expect(decodeState(`#${encodeState(withPhoto)}`)).toEqual(withPhoto);
  });

  it("round-trips a full state through the hash", () => {
    const decoded = decodeState(`#${encodeState(state)}`);
    expect(decoded).toEqual(state);
  });

  it("encodes the empty state as an empty hash", () => {
    expect(encodeState(EMPTY_STATE)).toBe("");
    expect(decodeState("")).toEqual(EMPTY_STATE);
    expect(decodeState("#")).toEqual(EMPTY_STATE);
  });

  it("falls back to the empty state on garbage", () => {
    expect(decodeState("#s=not-a-real-payload")).toEqual(EMPTY_STATE);
    expect(decodeState("#other=1")).toEqual(EMPTY_STATE);
  });

  it("caps the number of participants", () => {
    const many: AppState = {
      ...EMPTY_STATE,
      participants: Array.from({ length: MAX_PARTICIPANTS + 3 }, (_, i) =>
        stationParticipant(`p${i}`, "alpha"),
      ),
    };
    expect(decodeState(`#${encodeState(many)}`).participants).toHaveLength(MAX_PARTICIPANTS);
  });

  it("keeps the hash reasonably short for ten address participants", () => {
    const ten: AppState = {
      ...EMPTY_STATE,
      participants: Array.from({ length: MAX_PARTICIPANTS }, (_, i) =>
        addressParticipant(`participant-${i}`, 48.86 + i / 1000, 2.35 + i / 1000),
      ),
    };
    expect(encodeState(ten).length).toBeLessThan(1500);
  });
});
