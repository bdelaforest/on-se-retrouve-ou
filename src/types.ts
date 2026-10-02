export type LineMode = "metro" | "rer";

export interface LineStyle {
  color: string;
  textColor: string;
  mode: LineMode;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
}

export interface NetworkData {
  generatedAt: string;
  referenceDate: string;
  lines: Record<string, LineStyle>;
  stations: Station[];
  candidates: number[];
  matrix: number[];
}

export type Location =
  { kind: "station"; stationId: string } | { kind: "address"; label: string; lat: number; lon: number };

export interface Participant {
  id: string;
  name: string;
  location: Location;
  available: boolean;
  photoUrl?: string;
}

export const SORT_MODES = ["total", "max", "spread"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export interface AppState {
  participants: Participant[];
  chosenStationId: string | null;
  sortMode: SortMode;
}

export interface ParticipantTime {
  participantId: string;
  minutes: number;
}

export interface RankedStation {
  station: Station;
  times: ParticipantTime[];
  max: number;
  total: number;
  spread: number;
}

export interface Access {
  stationIndex: number;
  walkMinutes: number;
}

export interface ResolvedParticipant {
  participant: Participant;
  accesses: Access[];
  farFromNetwork: boolean;
}
