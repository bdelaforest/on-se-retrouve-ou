import { barsNearbyLinks } from "../core/external-maps";
import type { LineStyle, RankedStation } from "../types";
import LineBadge from "./LineBadge";

export interface ParticipantDisplay {
  name: string;
  color: string;
}

interface ResultCardProps {
  entry: RankedStation;
  rank: number | null;
  lines: Record<string, LineStyle>;
  participants: Map<string, ParticipantDisplay>;
  isChosen: boolean;
  onChoose: () => void;
  onUnchoose: () => void;
}

const ResultCard = ({
  entry,
  rank,
  lines,
  participants,
  isChosen,
  onChoose,
  onUnchoose,
}: ResultCardProps) => {
  const barLinks = barsNearbyLinks(entry.station.lat, entry.station.lon);
  const average = Math.round(entry.total / entry.times.length);
  const sortedTimes = [...entry.times].sort((a, b) => b.minutes - a.minutes);

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${isChosen ? "border-emerald-500 ring-2 ring-emerald-200" : "border-stone-200"}`}
    >
      <header className="flex items-start gap-3">
        {rank !== null && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {isChosen && <div className="text-xs font-semibold uppercase text-emerald-700">Rendez-vous à</div>}
          <h3 className="truncate text-lg font-semibold">{entry.station.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.station.lines.map((line) => (
              <LineBadge key={line} line={line} style={lines[line]} />
            ))}
          </div>
        </div>
        <dl className="shrink-0 text-right text-xs text-stone-500">
          <div>
            <dt className="inline">max </dt>
            <dd className="inline font-semibold text-stone-900">{entry.max} min</dd>
          </div>
          <div>
            <dt className="inline">moy. </dt>
            <dd className="inline">{average} min</dd>
          </div>
          <div>
            <dt className="inline">écart </dt>
            <dd className="inline">{entry.spread} min</dd>
          </div>
        </dl>
      </header>
      <ul className="mt-3 flex flex-col gap-1">
        {sortedTimes.map((time) => {
          const participant = participants.get(time.participantId);
          const width = entry.max === 0 ? 0 : (time.minutes / entry.max) * 100;
          return (
            <li key={time.participantId} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: participant?.color }}
              />
              <span className="w-24 truncate">{participant?.name ?? "?"}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-stone-100">
                <span
                  className="block h-full rounded"
                  style={{ width: `${width}%`, backgroundColor: participant?.color }}
                />
              </span>
              <span className="w-14 text-right tabular-nums">{time.minutes} min</span>
            </li>
          );
        })}
      </ul>
      <footer className="mt-3 flex flex-wrap gap-2">
        {barLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            {link.label}
          </a>
        ))}
        {isChosen ? (
          <button
            type="button"
            onClick={onUnchoose}
            className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
          >
            Annuler le choix
          </button>
        ) : (
          <button
            type="button"
            onClick={onChoose}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
          >
            Choisir cette station
          </button>
        )}
      </footer>
    </article>
  );
};

export default ResultCard;
