import type { Network } from "./network";
import type { Participant, ParticipantTime, RankedStation, ResolvedParticipant, SortMode } from "../types";

export const RESULTS_COUNT = 5;

export function availableParticipants(participants: Participant[]): Participant[] {
  return participants.filter((participant) => participant.available);
}

export function minutesToCandidate(
  resolved: ResolvedParticipant,
  network: Network,
  candidateIndex: number,
): number {
  let best = Infinity;
  for (const access of resolved.accesses) {
    const minutes = access.walkMinutes + network.travelMinutes(access.stationIndex, candidateIndex);
    if (minutes < best) best = minutes;
  }
  return best;
}

export function rankStations(
  network: Network,
  participants: Participant[],
  sortMode: SortMode,
): RankedStation[] {
  const resolved = availableParticipants(participants).map((participant) => network.resolve(participant));
  if (resolved.length === 0) return [];
  const ranked: RankedStation[] = [];
  for (const candidateIndex of network.candidateStationIndexes) {
    const times: ParticipantTime[] = resolved.map((entry) => ({
      participantId: entry.participant.id,
      minutes: Math.round(minutesToCandidate(entry, network, candidateIndex)),
    }));
    if (times.some((time) => !Number.isFinite(time.minutes))) continue;
    const minutes = times.map((time) => time.minutes);
    const max = Math.max(...minutes);
    const min = Math.min(...minutes);
    ranked.push({
      station: network.stations[candidateIndex],
      times,
      max,
      total: minutes.reduce((sum, value) => sum + value, 0),
      spread: max - min,
    });
  }
  return ranked.sort(compareBy(sortMode));
}

export function compareBy(sortMode: SortMode): (a: RankedStation, b: RankedStation) => number {
  return (a, b) => {
    const primary = a[sortMode] - b[sortMode];
    if (primary !== 0) return primary;
    if (a.total !== b.total) return a.total - b.total;
    if (a.max !== b.max) return a.max - b.max;
    return a.station.name.localeCompare(b.station.name, "fr");
  };
}

export function topResults(
  ranked: RankedStation[],
  chosenStationId: string | null,
): { chosen: RankedStation | null; alternatives: RankedStation[] } {
  const chosen = chosenStationId
    ? (ranked.find((entry) => entry.station.id === chosenStationId) ?? null)
    : null;
  const alternatives = ranked.filter((entry) => entry !== chosen).slice(0, RESULTS_COUNT);
  return { chosen, alternatives };
}
