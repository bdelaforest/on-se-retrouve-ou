import type { Access, Location, NetworkData, ResolvedParticipant, Participant, Station } from "../types";

export const WALK_SPEED_KMH = 4.5;
export const WALK_DETOUR_FACTOR = 1.3;
export const NEAREST_STATIONS_COUNT = 4;
export const FAR_FROM_NETWORK_METERS = 2000;

export class Network {
  readonly data: NetworkData;
  private readonly stationIndexById: Map<string, number>;
  private readonly candidateColumnByStationIndex: Map<number, number>;

  constructor(data: NetworkData) {
    this.data = data;
    this.stationIndexById = new Map(data.stations.map((station, index) => [station.id, index]));
    this.candidateColumnByStationIndex = new Map(
      data.candidates.map((stationIndex, column) => [stationIndex, column]),
    );
  }

  get stations(): Station[] {
    return this.data.stations;
  }

  get candidateStationIndexes(): number[] {
    return this.data.candidates;
  }

  stationById(id: string): Station | undefined {
    const index = this.stationIndexById.get(id);
    return index === undefined ? undefined : this.data.stations[index];
  }

  stationIndex(id: string): number | undefined {
    return this.stationIndexById.get(id);
  }

  travelMinutes(fromStationIndex: number, toCandidateStationIndex: number): number {
    const column = this.candidateColumnByStationIndex.get(toCandidateStationIndex);
    if (column === undefined) throw new Error(`Station ${toCandidateStationIndex} is not a candidate`);
    return this.data.matrix[fromStationIndex * this.data.candidates.length + column];
  }

  nearestStations(lat: number, lon: number, count: number): Access[] {
    const ranked = this.data.stations
      .map((station, index) => ({ index, meters: haversineMeters(lat, lon, station.lat, station.lon) }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, count);
    return ranked.map(({ index, meters }) => ({ stationIndex: index, walkMinutes: walkMinutes(meters) }));
  }

  resolve(participant: Participant): ResolvedParticipant {
    return {
      participant,
      accesses: this.accessesFor(participant.location),
      farFromNetwork: this.isFarFromNetwork(participant.location),
    };
  }

  private accessesFor(location: Location): Access[] {
    if (location.kind === "station") {
      const index = this.stationIndexById.get(location.stationId);
      if (index === undefined) return [];
      return [{ stationIndex: index, walkMinutes: 0 }];
    }
    return this.nearestStations(location.lat, location.lon, NEAREST_STATIONS_COUNT);
  }

  private isFarFromNetwork(location: Location): boolean {
    if (location.kind === "station") return false;
    const [nearest] = this.nearestStations(location.lat, location.lon, 1);
    if (!nearest) return true;
    const station = this.data.stations[nearest.stationIndex];
    return haversineMeters(location.lat, location.lon, station.lat, station.lon) > FAR_FROM_NETWORK_METERS;
  }
}

export function walkMinutes(meters: number): number {
  return (meters * WALK_DETOUR_FACTOR) / ((WALK_SPEED_KMH * 1000) / 60);
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}
