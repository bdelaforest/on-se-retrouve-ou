import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

const METRO_ROUTE_TYPE = "1";
const RAIL_ROUTE_TYPE = "2";
const RER_LINES = new Set(["A", "B", "C", "D", "E"]);
const TRANSFER_PENALTY_S = 240;
const MIN_WAIT_S = 60;
const MAX_WAIT_S = 600;
const WINDOW_START_S = 18 * 3600;
const WINDOW_END_S = 21 * 3600;
const WALK_SPEED_MPS = 4.5 / 3.6;
const WALK_DETOUR_FACTOR = 1.3;
const MAX_WALK_TRANSFER_M = 300;
const PARIS_CONTOUR_URL = "https://geo.api.gouv.fr/communes/75056?format=geojson&geometry=contour";

type LineMode = "metro" | "rer";

interface Route {
  id: string;
  shortName: string;
  color: string;
  textColor: string;
  mode: LineMode;
}

interface Trip {
  routeId: string;
  directionId: string;
}

interface RawStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  locationType: string;
  parent: string;
}

interface StopEvent {
  stationId: string;
  arrival: number;
  departure: number;
  sequence: number;
}

interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: Set<string>;
}

interface Edge {
  to: number;
  weight: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

async function readCsv(filePath: string, onRow: (row: Record<string, string>) => void): Promise<void> {
  const reader = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const rawLine of reader) {
    const line = rawLine.replace(/^﻿/, "");
    if (line.trim() === "") continue;
    const fields = parseCsvLine(line);
    if (!header) {
      header = fields;
      continue;
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = fields[i] ?? "";
    onRow(row);
  }
}

function parseGtfsTime(value: string): number {
  const [h, m, s] = value.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, polygon: number[][][]): boolean {
  if (!pointInRing(lon, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lon, lat, polygon[i])) return false;
  }
  return true;
}

function pointInGeometry(
  lon: number,
  lat: number,
  geometry: { type: string; coordinates: unknown },
): boolean {
  if (geometry.type === "Polygon") return pointInPolygon(lon, lat, geometry.coordinates as number[][][]);
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).some((polygon) => pointInPolygon(lon, lat, polygon));
  }
  throw new Error(`Unsupported geometry type ${geometry.type}`);
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseDate(value: string): Date {
  return new Date(
    Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))),
  );
}

function pickReferenceDate(feedStart: string): string {
  const today = formatDate(new Date());
  const date = parseDate(feedStart > today ? feedStart : today);
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 4) date.setUTCDate(date.getUTCDate() + 1);
  return formatDate(date);
}

class MinHeap {
  private readonly nodes: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, key: number): void {
    this.nodes.push(node);
    this.keys.push(key);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): [number, number] {
    const topNode = this.nodes[0];
    const topKey = this.keys[0];
    const lastNode = this.nodes.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.keys.length && this.keys[left] < this.keys[smallest]) smallest = left;
        if (right < this.keys.length && this.keys[right] < this.keys[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return [topNode, topKey];
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

function dijkstra(adjacency: Edge[][], source: number): Float64Array {
  const distances = new Float64Array(adjacency.length).fill(Infinity);
  distances[source] = 0;
  const heap = new MinHeap();
  heap.push(source, 0);
  while (heap.size > 0) {
    const [node, distance] = heap.pop();
    if (distance > distances[node]) continue;
    for (const edge of adjacency[node]) {
      const candidate = distance + edge.weight;
      if (candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        heap.push(edge.to, candidate);
      }
    }
  }
  return distances;
}

async function loadRoutes(gtfsDir: string): Promise<Map<string, Route>> {
  const routes = new Map<string, Route>();
  await readCsv(path.join(gtfsDir, "routes.txt"), (row) => {
    const isMetro = row.route_type === METRO_ROUTE_TYPE;
    const isRer = row.route_type === RAIL_ROUTE_TYPE && RER_LINES.has(row.route_short_name);
    if (!isMetro && !isRer) return;
    routes.set(row.route_id, {
      id: row.route_id,
      shortName: row.route_short_name,
      color: row.route_color || "888888",
      textColor: row.route_text_color || "000000",
      mode: isMetro ? "metro" : "rer",
    });
  });
  return routes;
}

async function loadActiveServices(gtfsDir: string, referenceDate: string): Promise<Set<string>> {
  const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    parseDate(referenceDate).getUTCDay()
  ];
  const active = new Set<string>();
  await readCsv(path.join(gtfsDir, "calendar.txt"), (row) => {
    if (row[weekday] === "1" && row.start_date <= referenceDate && row.end_date >= referenceDate) {
      active.add(row.service_id);
    }
  });
  await readCsv(path.join(gtfsDir, "calendar_dates.txt"), (row) => {
    if (row.date !== referenceDate) return;
    if (row.exception_type === "1") active.add(row.service_id);
    if (row.exception_type === "2") active.delete(row.service_id);
  });
  return active;
}

async function loadFeedStart(gtfsDir: string): Promise<string> {
  let start = "99999999";
  await readCsv(path.join(gtfsDir, "calendar.txt"), (row) => {
    if (row.start_date < start) start = row.start_date;
  });
  return start;
}

async function loadTrips(
  gtfsDir: string,
  routes: Map<string, Route>,
  services: Set<string>,
): Promise<Map<string, Trip>> {
  const trips = new Map<string, Trip>();
  await readCsv(path.join(gtfsDir, "trips.txt"), (row) => {
    if (!routes.has(row.route_id) || !services.has(row.service_id)) return;
    trips.set(row.trip_id, { routeId: row.route_id, directionId: row.direction_id });
  });
  return trips;
}

async function loadStops(gtfsDir: string): Promise<Map<string, RawStop>> {
  const stops = new Map<string, RawStop>();
  await readCsv(path.join(gtfsDir, "stops.txt"), (row) => {
    stops.set(row.stop_id, {
      id: row.stop_id,
      name: row.stop_name,
      lat: Number(row.stop_lat),
      lon: Number(row.stop_lon),
      locationType: row.location_type,
      parent: row.parent_station,
    });
  });
  return stops;
}

function stationIdOf(stopId: string, stops: Map<string, RawStop>): string {
  const stop = stops.get(stopId);
  if (!stop) return stopId;
  return stop.parent || stop.id;
}

async function loadStopEvents(
  gtfsDir: string,
  trips: Map<string, Trip>,
  stops: Map<string, RawStop>,
): Promise<Map<string, StopEvent[]>> {
  const events = new Map<string, StopEvent[]>();
  await readCsv(path.join(gtfsDir, "stop_times.txt"), (row) => {
    if (!trips.has(row.trip_id)) return;
    let list = events.get(row.trip_id);
    if (!list) {
      list = [];
      events.set(row.trip_id, list);
    }
    list.push({
      stationId: stationIdOf(row.stop_id, stops),
      arrival: parseGtfsTime(row.arrival_time),
      departure: parseGtfsTime(row.departure_time),
      sequence: Number(row.stop_sequence),
    });
  });
  for (const list of events.values()) list.sort((a, b) => a.sequence - b.sequence);
  return events;
}

async function loadParisGeometry(): Promise<{ type: string; coordinates: unknown }> {
  const response = await fetch(PARIS_CONTOUR_URL);
  if (!response.ok) throw new Error(`Failed to fetch Paris contour: ${response.status}`);
  const feature = (await response.json()) as { geometry: { type: string; coordinates: unknown } };
  return feature.geometry;
}

async function main(): Promise<void> {
  const gtfsDir = process.argv[2];
  if (!gtfsDir) {
    console.error("Usage: tsx scripts/build-network.ts <gtfs-dir> [reference-date YYYYMMDD]");
    process.exit(1);
  }
  const outFile = path.resolve("public/data/network.json");

  console.log("Loading routes…");
  const routes = await loadRoutes(gtfsDir);
  console.log(`  ${routes.size} metro/RER routes`);

  const feedStart = await loadFeedStart(gtfsDir);
  const referenceDate = process.argv[3] ?? pickReferenceDate(feedStart);
  console.log(`Reference date: ${referenceDate}`);
  const services = await loadActiveServices(gtfsDir, referenceDate);
  console.log(`  ${services.size} active services`);

  console.log("Loading trips…");
  const trips = await loadTrips(gtfsDir, routes, services);
  console.log(`  ${trips.size} trips`);

  console.log("Loading stops…");
  const stops = await loadStops(gtfsDir);

  console.log("Streaming stop_times…");
  const tripEvents = await loadStopEvents(gtfsDir, trips, stops);
  console.log(`  ${tripEvents.size} trips with stop events`);

  const stations = new Map<string, Station>();
  const rideSamples = new Map<string, number[]>();
  const departureCounts = new Map<string, number>();
  const routeStationKeys = new Set<string>();

  for (const [tripId, events] of tripEvents) {
    const trip = trips.get(tripId)!;
    const route = routes.get(trip.routeId)!;
    for (const event of events) {
      const raw = stops.get(event.stationId);
      if (!raw) continue;
      let station = stations.get(event.stationId);
      if (!station) {
        station = { id: raw.id, name: raw.name, lat: raw.lat, lon: raw.lon, lines: new Set() };
        stations.set(event.stationId, station);
      }
      station.lines.add(route.shortName);
      routeStationKeys.add(`${route.id}|${event.stationId}`);
      if (event.departure >= WINDOW_START_S && event.departure < WINDOW_END_S) {
        const key = `${route.id}|${event.stationId}|${trip.directionId}`;
        departureCounts.set(key, (departureCounts.get(key) ?? 0) + 1);
      }
    }
    for (let i = 0; i + 1 < events.length; i++) {
      const from = events[i];
      const to = events[i + 1];
      if (from.stationId === to.stationId) continue;
      const duration = to.arrival - from.departure;
      if (duration <= 0) continue;
      const key = `${route.id}|${from.stationId}|${to.stationId}`;
      let samples = rideSamples.get(key);
      if (!samples) {
        samples = [];
        rideSamples.set(key, samples);
      }
      samples.push(duration);
    }
  }
  console.log(`  ${stations.size} stations, ${rideSamples.size} directed ride segments`);

  const routeWaitFallback = new Map<string, number>();
  for (const route of routes.values()) {
    const waits: number[] = [];
    for (const [key, count] of departureCounts) {
      if (key.startsWith(`${route.id}|`)) waits.push((WINDOW_END_S - WINDOW_START_S) / count / 2);
    }
    routeWaitFallback.set(route.id, waits.length > 0 ? median(waits) : MAX_WAIT_S);
  }

  function waitFor(routeId: string, stationId: string): number {
    const waits: number[] = [];
    for (const direction of ["0", "1", ""]) {
      const count = departureCounts.get(`${routeId}|${stationId}|${direction}`);
      if (count) waits.push((WINDOW_END_S - WINDOW_START_S) / count / 2);
    }
    const wait =
      waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : routeWaitFallback.get(routeId)!;
    return Math.min(MAX_WAIT_S, Math.max(MIN_WAIT_S, wait));
  }

  console.log("Loading transfers…");
  const stationIds = [...stations.keys()];
  const stationIndex = new Map(stationIds.map((id, index) => [id, index]));
  const transferTimes = new Map<string, number>();
  await readCsv(path.join(gtfsDir, "transfers.txt"), (row) => {
    const from = stationIdOf(row.from_stop_id, stops);
    const to = stationIdOf(row.to_stop_id, stops);
    if (from === to || !stationIndex.has(from) || !stationIndex.has(to)) return;
    const time = Number(row.min_transfer_time);
    if (!Number.isFinite(time) || time <= 0) return;
    const key = `${from}|${to}`;
    transferTimes.set(key, Math.min(transferTimes.get(key) ?? Infinity, time));
  });
  for (let i = 0; i < stationIds.length; i++) {
    for (let j = 0; j < stationIds.length; j++) {
      if (i === j) continue;
      const a = stations.get(stationIds[i])!;
      const b = stations.get(stationIds[j])!;
      const distance = haversineMeters(a.lat, a.lon, b.lat, b.lon);
      if (distance > MAX_WALK_TRANSFER_M) continue;
      const key = `${a.id}|${b.id}`;
      if (!transferTimes.has(key)) {
        transferTimes.set(key, (distance * WALK_DETOUR_FACTOR) / WALK_SPEED_MPS + TRANSFER_PENALTY_S);
      }
    }
  }
  console.log(`  ${transferTimes.size} inter-station transfers`);

  console.log("Building graph…");
  const nodeCount = { value: 0 };
  const entryNode = new Map<string, number>();
  const exitNode = new Map<string, number>();
  const platformNode = new Map<string, number>();
  const nextNode = () => nodeCount.value++;
  for (const id of stationIds) {
    entryNode.set(id, nextNode());
    exitNode.set(id, nextNode());
  }
  for (const key of routeStationKeys) platformNode.set(key, nextNode());
  const adjacency: Edge[][] = Array.from({ length: nodeCount.value }, () => []);
  const platformsByStation = new Map<string, string[]>();
  for (const key of routeStationKeys) {
    const [routeId, stationId] = key.split("|");
    const list = platformsByStation.get(stationId) ?? [];
    list.push(routeId);
    platformsByStation.set(stationId, list);
  }
  for (const [stationId, routeIds] of platformsByStation) {
    const entry = entryNode.get(stationId)!;
    const exit = exitNode.get(stationId)!;
    for (const routeId of routeIds) {
      const platform = platformNode.get(`${routeId}|${stationId}`)!;
      adjacency[entry].push({ to: platform, weight: waitFor(routeId, stationId) });
      adjacency[platform].push({ to: exit, weight: 0 });
      for (const otherRouteId of routeIds) {
        if (otherRouteId === routeId) continue;
        const other = platformNode.get(`${otherRouteId}|${stationId}`)!;
        adjacency[platform].push({
          to: other,
          weight: TRANSFER_PENALTY_S + waitFor(otherRouteId, stationId),
        });
      }
    }
  }
  for (const [key, samples] of rideSamples) {
    const [routeId, from, to] = key.split("|");
    const fromPlatform = platformNode.get(`${routeId}|${from}`)!;
    const toPlatform = platformNode.get(`${routeId}|${to}`)!;
    adjacency[fromPlatform].push({ to: toPlatform, weight: median(samples) });
  }
  for (const [key, time] of transferTimes) {
    const [from, to] = key.split("|");
    for (const fromRouteId of platformsByStation.get(from) ?? []) {
      const fromPlatform = platformNode.get(`${fromRouteId}|${from}`)!;
      for (const toRouteId of platformsByStation.get(to) ?? []) {
        const toPlatform = platformNode.get(`${toRouteId}|${to}`)!;
        adjacency[fromPlatform].push({ to: toPlatform, weight: time + waitFor(toRouteId, to) });
      }
    }
  }
  console.log(`  ${nodeCount.value} nodes`);

  console.log("Fetching Paris contour…");
  const paris = await loadParisGeometry();
  const lineModes = new Map<string, LineMode>();
  for (const route of routes.values()) lineModes.set(route.shortName, route.mode);
  const candidateIds = stationIds.filter((id) => {
    const station = stations.get(id)!;
    const hasMetro = [...station.lines].some((line) => lineModes.get(line) === "metro");
    return hasMetro && pointInGeometry(station.lon, station.lat, paris);
  });
  console.log(`  ${candidateIds.length} candidate stations in Paris`);

  console.log("Computing shortest paths…");
  const candidateIndex = new Map(candidateIds.map((id, index) => [id, index]));
  const matrix = new Array<number>(stationIds.length * candidateIds.length).fill(-1);
  for (let i = 0; i < stationIds.length; i++) {
    const distances = dijkstra(adjacency, entryNode.get(stationIds[i])!);
    for (const candidateId of candidateIds) {
      const j = candidateIndex.get(candidateId)!;
      const seconds = candidateId === stationIds[i] ? 0 : distances[exitNode.get(candidateId)!];
      matrix[i * candidateIds.length + j] = Number.isFinite(seconds) ? Math.round(seconds / 60) : -1;
    }
  }

  console.log("Checking consistency…");
  const unreachable = matrix.filter((value) => value < 0).length;
  if (unreachable > 0) throw new Error(`${unreachable} unreachable station pairs`);
  let asymmetric = 0;
  for (const a of candidateIds) {
    for (const b of candidateIds) {
      const ab = matrix[stationIndex.get(a)! * candidateIds.length + candidateIndex.get(b)!];
      const ba = matrix[stationIndex.get(b)! * candidateIds.length + candidateIndex.get(a)!];
      if (Math.abs(ab - ba) > 5) asymmetric++;
    }
  }
  console.log(`  ${asymmetric} candidate pairs differ by more than 5 minutes between directions`);
  const byName = (name: string) => stationIds.find((id) => stations.get(id)!.name === name);
  const expectations: Array<[string, string, number, number]> = [
    ["Châtelet", "Nation", 8, 20],
    ["Nation", "Charles de Gaulle - Étoile", 10, 30],
    ["Gare du Nord", "Gare Montparnasse", 10, 30],
  ];
  for (const [fromName, toName, min, max] of expectations) {
    const from = byName(fromName);
    const to = byName(toName);
    if (!from || !to) {
      console.warn(`  Could not find ${fromName} or ${toName}`);
      continue;
    }
    const minutes = matrix[stationIndex.get(from)! * candidateIds.length + candidateIndex.get(to)!];
    const status = minutes >= min && minutes <= max ? "ok" : "OUT OF RANGE";
    console.log(`  ${fromName} → ${toName}: ${minutes} min (${status})`);
    if (status !== "ok") throw new Error(`Implausible travel time ${fromName} → ${toName}: ${minutes} min`);
  }
  const duplicateNames = new Map<string, number>();
  for (const station of stations.values())
    duplicateNames.set(station.name, (duplicateNames.get(station.name) ?? 0) + 1);
  const duplicates = [...duplicateNames].filter(([, count]) => count > 1).map(([name]) => name);
  if (duplicates.length > 0) console.log(`  Duplicate station names: ${duplicates.join(", ")}`);

  const lines: Record<string, { color: string; textColor: string; mode: LineMode }> = {};
  for (const route of routes.values()) {
    lines[route.shortName] = { color: `#${route.color}`, textColor: `#${route.textColor}`, mode: route.mode };
  }
  const output = {
    generatedAt: new Date().toISOString(),
    referenceDate,
    lines,
    stations: stationIds.map((id) => {
      const station = stations.get(id)!;
      return {
        id: station.id,
        name: station.name,
        lat: Number(station.lat.toFixed(6)),
        lon: Number(station.lon.toFixed(6)),
        lines: [...station.lines].sort(),
      };
    }),
    candidates: candidateIds.map((id) => stationIndex.get(id)!),
    matrix,
  };
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(output));
  console.log(`Wrote ${outFile} (${(Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(0)} KiB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
