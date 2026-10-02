import { useMemo, useState } from "react";
import MapView, { type MapParticipant } from "./components/MapView";
import ParticipantForm from "./components/ParticipantForm";
import ParticipantList from "./components/ParticipantList";
import type { ParticipantDisplay } from "./components/ResultCard";
import ResultList from "./components/ResultList";
import { participantColor } from "./core/colors";
import { availableParticipants, rankStations, topResults } from "./core/ranking";
import { MAX_PARTICIPANTS } from "./core/url-state";
import { useNetwork } from "./hooks/use-network";
import { useUrlState } from "./hooks/use-url-state";
import type { Location, Participant } from "./types";

const newId = (): string => Math.random().toString(36).slice(2, 8);

const App = () => {
  const networkState = useNetwork();
  const [state, update] = useUrlState();
  const [copied, setCopied] = useState(false);

  const network = networkState.status === "ready" ? networkState.network : null;

  const colorById = useMemo(
    () => new Map(state.participants.map((participant, index) => [participant.id, participantColor(index)])),
    [state.participants],
  );
  const colorOf = (participantId: string) => colorById.get(participantId) ?? "#78716c";

  const ranked = useMemo(
    () => (network ? rankStations(network, state.participants, state.sortMode) : []),
    [network, state.participants, state.sortMode],
  );
  const { chosen, alternatives } = useMemo(
    () => topResults(ranked, state.chosenStationId),
    [ranked, state.chosenStationId],
  );
  const available = availableParticipants(state.participants);

  const participantDisplays = new Map<string, ParticipantDisplay>(
    state.participants.map((participant) => [
      participant.id,
      { name: participant.name, color: colorOf(participant.id) },
    ]),
  );
  const participantNames = new Map(
    state.participants.map((participant) => [participant.id, participant.name]),
  );

  const mapParticipants: MapParticipant[] = network
    ? available.flatMap((participant) => {
        const coordinates = coordinatesOf(participant, network.stationById.bind(network));
        if (!coordinates) return [];
        return [
          {
            id: participant.id,
            name: participant.name,
            color: colorOf(participant.id),
            photoUrl: participant.photoUrl,
            ...coordinates,
          },
        ];
      })
    : [];

  const addParticipant = (name: string, location: Location, photoUrl: string | undefined) =>
    update((previous) => ({
      ...previous,
      participants: [
        ...previous.participants,
        { id: newId(), name, location, available: true, photoUrl },
      ].slice(0, MAX_PARTICIPANTS),
    }));

  const toggleParticipant = (participantId: string) =>
    update((previous) => ({
      ...previous,
      participants: previous.participants.map((participant) =>
        participant.id === participantId
          ? { ...participant, available: !participant.available }
          : participant,
      ),
    }));

  const removeParticipant = (participantId: string) =>
    update((previous) => ({
      ...previous,
      participants: previous.participants.filter((participant) => participant.id !== participantId),
    }));

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "On se retrouve où ?", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row-reverse">
      <section className="h-72 shrink-0 lg:h-full lg:w-1/2">
        <MapView
          participants={mapParticipants}
          results={chosen ? [chosen, ...alternatives] : alternatives}
          chosenStationId={state.chosenStationId}
          participantNames={participantNames}
          onChoose={(stationId) => update((previous) => ({ ...previous, chosenStationId: stationId }))}
        />
      </section>
      <main className="flex flex-1 flex-col gap-5 p-4 lg:h-full lg:w-1/2 lg:overflow-y-auto lg:p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">On se retrouve où ?</h1>
            <p className="text-sm text-stone-500">
              La station de métro la plus équitable pour tout le monde.
            </p>
          </div>
          <button
            type="button"
            onClick={share}
            disabled={state.participants.length === 0}
            className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50"
          >
            {copied ? "Lien copié !" : "Partager"}
          </button>
        </header>

        {networkState.status === "loading" && <p className="text-sm text-stone-500">Chargement du réseau…</p>}
        {networkState.status === "error" && (
          <p className="text-sm text-red-600">Impossible de charger le réseau : {networkState.message}</p>
        )}

        {network && (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">Participants</h2>
              <ParticipantList
                network={network}
                participants={state.participants}
                colorOf={colorOf}
                onToggle={toggleParticipant}
                onRemove={removeParticipant}
              />
              <ParticipantForm
                network={network}
                disabled={state.participants.length >= MAX_PARTICIPANTS}
                onAdd={addParticipant}
              />
            </section>
            {state.participants.length > 0 && (
              <ResultList
                chosen={chosen}
                alternatives={alternatives}
                availableCount={available.length}
                lines={network.data.lines}
                participants={participantDisplays}
                sortMode={state.sortMode}
                onSortChange={(sortMode) => update((previous) => ({ ...previous, sortMode }))}
                onChoose={(chosenStationId) => update((previous) => ({ ...previous, chosenStationId }))}
              />
            )}
          </>
        )}

        <footer className="mt-auto pt-4 text-xs text-stone-400">
          Temps estimés à partir des horaires Île-de-France Mobilités
          {network && ` (données du ${formatReferenceDate(network.data.referenceDate)})`}. Fond de carte
          OpenStreetMap, adresses par la Base Adresse Nationale.
        </footer>
      </main>
    </div>
  );
};

function coordinatesOf(
  participant: Participant,
  stationById: (id: string) => { lat: number; lon: number } | undefined,
): { lat: number; lon: number } | null {
  if (participant.location.kind === "address") {
    return { lat: participant.location.lat, lon: participant.location.lon };
  }
  const station = stationById(participant.location.stationId);
  return station ? { lat: station.lat, lon: station.lon } : null;
}

function formatReferenceDate(value: string): string {
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}

export default App;
