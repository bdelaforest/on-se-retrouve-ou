import { useState } from "react";
import type { Network } from "../core/network";
import type { Participant } from "../types";
import ParticipantForm, { type ParticipantDraft } from "./ParticipantForm";

interface ParticipantListProps {
  network: Network;
  participants: Participant[];
  colorOf: (participantId: string) => string;
  onToggle: (participantId: string) => void;
  onUpdate: (participantId: string, draft: ParticipantDraft) => void;
  onRemove: (participantId: string) => void;
}

const ParticipantList = ({
  network,
  participants,
  colorOf,
  onToggle,
  onUpdate,
  onRemove,
}: ParticipantListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (participants.length === 0) {
    return (
      <p className="text-sm text-stone-500">Ajoute les participants pour trouver le point de rendez-vous.</p>
    );
  }
  return (
    <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
      {participants.map((participant) => {
        if (participant.id === editingId) {
          return (
            <li key={participant.id} className="p-2">
              <ParticipantForm
                network={network}
                initial={{
                  name: participant.name,
                  location: participant.location,
                  photoUrl: participant.photoUrl,
                }}
                submitLabel="Enregistrer"
                onSubmit={(draft) => {
                  onUpdate(participant.id, draft);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          );
        }
        const resolved = network.resolve(participant);
        const label =
          participant.location.kind === "station"
            ? (network.stationById(participant.location.stationId)?.name ?? "Station inconnue")
            : participant.location.label;
        return (
          <li key={participant.id} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              checked={participant.available}
              onChange={() => onToggle(participant.id)}
              aria-label={`${participant.name} disponible`}
              className="h-4 w-4 accent-stone-900"
            />
            {participant.photoUrl ? (
              <img
                src={participant.photoUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover"
                style={{ border: `2px solid ${colorOf(participant.id)}` }}
              />
            ) : (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colorOf(participant.id) }}
              />
            )}
            <button
              type="button"
              onClick={() => setEditingId(participant.id)}
              className={`min-w-0 flex-1 text-left ${participant.available ? "" : "text-stone-400 line-through"}`}
              aria-label={`Modifier ${participant.name}`}
            >
              <div className="truncate text-sm font-medium">{participant.name}</div>
              <div className="truncate text-xs text-stone-500">{label}</div>
              {resolved.farFromNetwork && (
                <div className="text-xs text-amber-700">Loin du réseau : temps de marche important.</div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(participant.id)}
              aria-label={`Modifier ${participant.name}`}
              className="text-stone-400 hover:text-stone-900"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => onRemove(participant.id)}
              aria-label={`Retirer ${participant.name}`}
              className="text-stone-400 hover:text-red-600"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ParticipantList;
