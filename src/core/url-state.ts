import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { SORT_MODES, type AppState, type Location, type Participant, type SortMode } from "../types";

const STATE_VERSION = 1;
const HASH_PARAM = "s";
export const MAX_PARTICIPANTS = 10;

interface SerializedState {
  v: number;
  p: SerializedParticipant[];
  c: string | null;
  o: SortMode;
}

interface SerializedParticipantBase {
  i: string;
  n: string;
  a: 0 | 1;
  f?: string;
}

type SerializedParticipant =
  | (SerializedParticipantBase & { s: string })
  | (SerializedParticipantBase & { l: string; y: number; x: number });

export const EMPTY_STATE: AppState = { participants: [], chosenStationId: null, sortMode: "max" };

export function encodeState(state: AppState): string {
  if (state.participants.length === 0 && state.chosenStationId === null && state.sortMode === "max")
    return "";
  const serialized: SerializedState = {
    v: STATE_VERSION,
    p: state.participants.map(serializeParticipant),
    c: state.chosenStationId,
    o: state.sortMode,
  };
  return `${HASH_PARAM}=${compressToEncodedURIComponent(JSON.stringify(serialized))}`;
}

export function decodeState(hash: string): AppState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get(HASH_PARAM);
  if (!encoded) return EMPTY_STATE;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return EMPTY_STATE;
    const parsed = JSON.parse(json) as Partial<SerializedState>;
    if (parsed.v !== STATE_VERSION || !Array.isArray(parsed.p)) return EMPTY_STATE;
    const participants = parsed.p
      .map(deserializeParticipant)
      .filter((participant): participant is Participant => participant !== null)
      .slice(0, MAX_PARTICIPANTS);
    return {
      participants,
      chosenStationId: typeof parsed.c === "string" ? parsed.c : null,
      sortMode: isSortMode(parsed.o) ? parsed.o : "max",
    };
  } catch {
    return EMPTY_STATE;
  }
}

function serializeParticipant(participant: Participant): SerializedParticipant {
  const base: SerializedParticipantBase = {
    i: participant.id,
    n: participant.name,
    a: participant.available ? 1 : 0,
  };
  if (participant.photoUrl) base.f = participant.photoUrl;
  const location = participant.location;
  if (location.kind === "station") return { ...base, s: location.stationId };
  return { ...base, l: location.label, y: round(location.lat), x: round(location.lon) };
}

function deserializeParticipant(raw: unknown): Participant | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.i !== "string" || typeof record.n !== "string") return null;
  const location = deserializeLocation(record);
  if (!location) return null;
  const participant: Participant = { id: record.i, name: record.n, available: record.a !== 0, location };
  if (typeof record.f === "string" && record.f.length > 0) participant.photoUrl = record.f;
  return participant;
}

function deserializeLocation(record: Record<string, unknown>): Location | null {
  if (typeof record.s === "string") return { kind: "station", stationId: record.s };
  if (typeof record.l === "string" && typeof record.y === "number" && typeof record.x === "number") {
    return { kind: "address", label: record.l, lat: record.y, lon: record.x };
  }
  return null;
}

function isSortMode(value: unknown): value is SortMode {
  return typeof value === "string" && (SORT_MODES as readonly string[]).includes(value);
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
