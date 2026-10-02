import { useState } from "react";
import type { Network } from "../core/network";
import type { Location } from "../types";
import LocationSearch from "./LocationSearch";

interface ParticipantFormProps {
  network: Network;
  disabled: boolean;
  onAdd: (name: string, location: Location, photoUrl: string | undefined) => void;
}

const ParticipantForm = ({ network, disabled, onAdd }: ParticipantFormProps) => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [showPhoto, setShowPhoto] = useState(false);

  const locationLabel =
    location === null
      ? null
      : location.kind === "station"
        ? (network.stationById(location.stationId)?.name ?? "Station inconnue")
        : location.label;

  const canSubmit = !disabled && name.trim().length > 0 && location !== null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || location === null) return;
    onAdd(name.trim(), location, photoUrl.trim() || undefined);
    setName("");
    setLocation(null);
    setPhotoUrl("");
    setShowPhoto(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          placeholder="Prénom"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 disabled:bg-stone-100 sm:w-36"
        />
        <div className="flex-1">
          {location === null ? (
            <LocationSearch network={network} onSelect={setLocation} disabled={disabled} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm">
              <span className="flex-1 truncate">{locationLabel}</span>
              <button
                type="button"
                onClick={() => setLocation(null)}
                className="text-stone-500 hover:text-stone-900"
                aria-label="Changer le point de départ"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:bg-stone-300"
        >
          Ajouter
        </button>
      </div>
      {showPhoto ? (
        <input
          type="url"
          value={photoUrl}
          disabled={disabled}
          onChange={(event) => setPhotoUrl(event.target.value)}
          placeholder="URL de la photo (optionnel)"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 disabled:bg-stone-100"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowPhoto(true)}
          disabled={disabled}
          className="self-start text-xs text-stone-500 underline-offset-2 hover:underline disabled:no-underline"
        >
          Ajouter une photo
        </button>
      )}
      {disabled && <p className="text-xs text-stone-500">Maximum de 10 participants atteint.</p>}
    </form>
  );
};

export default ParticipantForm;
