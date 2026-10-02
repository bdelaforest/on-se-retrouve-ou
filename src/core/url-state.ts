import { deflateSync, inflateSync } from "fflate";
import { decompressFromEncodedURIComponent } from "lz-string";
import { SORT_MODES, type AppState, type Location, type Participant, type SortMode } from "../types";

const BINARY_VERSION = 2;
const BINARY_PARAM = "v";
const LEGACY_PARAM = "s";
const LEGACY_VERSION = 1;
const STATION_ID_PREFIX = "IDFM:";
const COORDINATE_SCALE = 1e5;
const SORT_MODE_CODES: readonly SortMode[] = ["max", "total", "spread"];
const DEFAULT_SORT_MODE: SortMode = "total";
export const MAX_PARTICIPANTS = 10;

export const EMPTY_STATE: AppState = { participants: [], chosenStationId: null, sortMode: DEFAULT_SORT_MODE };

export function encodeState(state: AppState): string {
  if (
    state.participants.length === 0 &&
    state.chosenStationId === null &&
    state.sortMode === DEFAULT_SORT_MODE
  ) {
    return "";
  }
  const writer = new ByteWriter();
  writer.u8(BINARY_VERSION);
  writer.u8((state.chosenStationId ? 1 : 0) | (SORT_MODE_CODES.indexOf(state.sortMode) << 1));
  if (state.chosenStationId) writer.u24(stationNumber(state.chosenStationId));
  const participants = state.participants.slice(0, MAX_PARTICIPANTS);
  writer.u8(participants.length);
  for (const participant of participants) writeParticipant(writer, participant);
  const compressed = deflateSync(writer.bytes(), { level: 9 });
  return `${BINARY_PARAM}=${toBase64Url(compressed)}`;
}

export function decodeState(hash: string): AppState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const binary = params.get(BINARY_PARAM);
  if (binary) return decodeBinary(binary);
  const legacy = params.get(LEGACY_PARAM);
  if (legacy) return decodeLegacy(legacy);
  return EMPTY_STATE;
}

function writeParticipant(writer: ByteWriter, participant: Participant): void {
  const location = participant.location;
  const flags =
    (participant.available ? 1 : 0) | (location.kind === "address" ? 2 : 0) | (participant.photoUrl ? 4 : 0);
  writer.u8(flags);
  writer.string(participant.name);
  if (location.kind === "station") {
    writer.u24(stationNumber(location.stationId));
  } else {
    writer.i32(Math.round(location.lat * COORDINATE_SCALE));
    writer.i32(Math.round(location.lon * COORDINATE_SCALE));
    writer.string(location.label);
  }
  if (participant.photoUrl) writer.string(participant.photoUrl);
}

function decodeBinary(encoded: string): AppState {
  try {
    const reader = new ByteReader(inflateSync(fromBase64Url(encoded)));
    if (reader.u8() !== BINARY_VERSION) return EMPTY_STATE;
    const header = reader.u8();
    const chosenStationId = header & 1 ? stationId(reader.u24()) : null;
    const sortMode = SORT_MODE_CODES[(header >> 1) & 3] ?? DEFAULT_SORT_MODE;
    const count = Math.min(reader.u8(), MAX_PARTICIPANTS);
    const participants: Participant[] = [];
    for (let index = 0; index < count; index++) participants.push(readParticipant(reader, `p${index + 1}`));
    return { participants, chosenStationId, sortMode };
  } catch {
    return EMPTY_STATE;
  }
}

function readParticipant(reader: ByteReader, id: string): Participant {
  const flags = reader.u8();
  const name = reader.string();
  const location: Location =
    flags & 2
      ? {
          kind: "address",
          lat: reader.i32() / COORDINATE_SCALE,
          lon: reader.i32() / COORDINATE_SCALE,
          label: reader.string(),
        }
      : { kind: "station", stationId: stationId(reader.u24()) };
  const participant: Participant = { id, name, available: (flags & 1) !== 0, location };
  if (flags & 4) participant.photoUrl = reader.string();
  return participant;
}

function stationNumber(id: string): number {
  if (!id.startsWith(STATION_ID_PREFIX)) throw new Error(`Unexpected station id ${id}`);
  const value = Number(id.slice(STATION_ID_PREFIX.length));
  if (!Number.isInteger(value) || value < 0 || value >= 1 << 24)
    throw new Error(`Unexpected station id ${id}`);
  return value;
}

function stationId(value: number): string {
  return `${STATION_ID_PREFIX}${value}`;
}

class ByteWriter {
  private readonly chunks: number[] = [];
  private readonly encoder = new TextEncoder();

  u8(value: number): void {
    this.chunks.push(value & 0xff);
  }

  u16(value: number): void {
    this.u8(value >> 8);
    this.u8(value);
  }

  u24(value: number): void {
    this.u8(value >> 16);
    this.u16(value);
  }

  i32(value: number): void {
    this.u8(value >>> 24);
    this.u24(value & 0xffffff);
  }

  string(value: string): void {
    const encoded = this.encoder.encode(value);
    if (encoded.length > 0xffff) throw new Error("String too long");
    this.u16(encoded.length);
    for (const byte of encoded) this.chunks.push(byte);
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

class ByteReader {
  private offset = 0;
  private readonly decoder = new TextDecoder();
  private readonly data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  u8(): number {
    if (this.offset >= this.data.length) throw new Error("Unexpected end of data");
    return this.data[this.offset++];
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  u24(): number {
    return (this.u8() << 16) | this.u16();
  }

  i32(): number {
    return (this.u8() << 24) | this.u24() | 0;
  }

  string(): string {
    const length = this.u16();
    if (this.offset + length > this.data.length) throw new Error("Unexpected end of data");
    const value = this.decoder.decode(this.data.subarray(this.offset, this.offset + length));
    this.offset += length;
    return value;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

interface LegacyState {
  v: number;
  p: unknown[];
  c: string | null;
  o: SortMode;
}

function decodeLegacy(encoded: string): AppState {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return EMPTY_STATE;
    const parsed = JSON.parse(json) as Partial<LegacyState>;
    if (parsed.v !== LEGACY_VERSION || !Array.isArray(parsed.p)) return EMPTY_STATE;
    const participants = parsed.p
      .map(decodeLegacyParticipant)
      .filter((participant): participant is Participant => participant !== null)
      .slice(0, MAX_PARTICIPANTS);
    return {
      participants,
      chosenStationId: typeof parsed.c === "string" ? parsed.c : null,
      sortMode: isSortMode(parsed.o) ? parsed.o : DEFAULT_SORT_MODE,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function decodeLegacyParticipant(raw: unknown): Participant | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.i !== "string" || typeof record.n !== "string") return null;
  let location: Location;
  if (typeof record.s === "string") {
    location = { kind: "station", stationId: record.s };
  } else if (typeof record.l === "string" && typeof record.y === "number" && typeof record.x === "number") {
    location = { kind: "address", label: record.l, lat: record.y, lon: record.x };
  } else {
    return null;
  }
  const participant: Participant = { id: record.i, name: record.n, available: record.a !== 0, location };
  if (typeof record.f === "string" && record.f.length > 0) participant.photoUrl = record.f;
  return participant;
}

function isSortMode(value: unknown): value is SortMode {
  return typeof value === "string" && (SORT_MODES as readonly string[]).includes(value);
}
