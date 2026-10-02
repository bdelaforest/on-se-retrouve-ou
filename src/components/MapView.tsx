import { divIcon, latLngBounds } from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { RankedStation } from "../types";

const PARIS_CENTER: [number, number] = [48.8566, 2.3522];

export interface MapParticipant {
  id: string;
  name: string;
  color: string;
  lat: number;
  lon: number;
  photoUrl?: string;
}

const PHOTO_SIZE = 36;

function photoIcon(participant: MapParticipant) {
  const image = document.createElement("img");
  image.src = participant.photoUrl ?? "";
  image.alt = participant.name;
  image.style.cssText = `width:${PHOTO_SIZE}px;height:${PHOTO_SIZE}px;border-radius:9999px;object-fit:cover;border:3px solid ${participant.color};box-shadow:0 1px 4px rgba(0,0,0,.4);background:#fff`;
  return divIcon({
    html: image,
    className: "",
    iconSize: [PHOTO_SIZE, PHOTO_SIZE],
    iconAnchor: [PHOTO_SIZE / 2, PHOTO_SIZE / 2],
    tooltipAnchor: [0, -PHOTO_SIZE / 2],
  });
}

interface MapViewProps {
  participants: MapParticipant[];
  results: RankedStation[];
  chosenStationId: string | null;
  participantNames: Map<string, string>;
  onChoose: (stationId: string) => void;
}

const FitBounds = ({ points }: { points: Array<[number, number]> }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView(PARIS_CENTER, 12);
      return;
    }
    map.fitBounds(latLngBounds(points).pad(0.2), { maxZoom: 15 });
  }, [map, points]);
  return null;
};

const MapView = ({ participants, results, chosenStationId, participantNames, onChoose }: MapViewProps) => {
  const points: Array<[number, number]> = [
    ...participants.map((participant): [number, number] => [participant.lat, participant.lon]),
    ...results.map((entry): [number, number] => [entry.station.lat, entry.station.lon]),
  ];

  return (
    <MapContainer center={PARIS_CENTER} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {results.map((entry, index) => {
        const isChosen = entry.station.id === chosenStationId;
        return (
          <CircleMarker
            key={entry.station.id}
            center={[entry.station.lat, entry.station.lon]}
            radius={isChosen ? 12 : 9}
            pathOptions={{
              color: isChosen ? "#059669" : "#1c1917",
              fillColor: isChosen ? "#10b981" : "#ffffff",
              fillOpacity: 1,
              weight: 2,
            }}
            eventHandlers={{ click: () => onChoose(entry.station.id) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="text-sm">
                <div className="font-semibold">
                  {isChosen ? "★ " : `${index + 1}. `}
                  {entry.station.name}
                </div>
                {entry.times.map((time) => (
                  <div key={time.participantId}>
                    {participantNames.get(time.participantId) ?? "?"} : {time.minutes} min
                  </div>
                ))}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
      {participants.map((participant) =>
        participant.photoUrl ? (
          <Marker
            key={participant.id}
            position={[participant.lat, participant.lon]}
            icon={photoIcon(participant)}
          >
            <Tooltip direction="top">{participant.name}</Tooltip>
          </Marker>
        ) : (
          <CircleMarker
            key={participant.id}
            center={[participant.lat, participant.lon]}
            radius={7}
            pathOptions={{ color: "#ffffff", fillColor: participant.color, fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {participant.name}
            </Tooltip>
          </CircleMarker>
        ),
      )}
    </MapContainer>
  );
};

export default MapView;
