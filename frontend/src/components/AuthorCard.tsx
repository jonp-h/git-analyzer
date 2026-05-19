import type { AuthorStats } from "../types";
import { formatDistanceToNow, parseISO } from "date-fns";

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${highlight ?? "text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}

function formatGap(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function AuthorCard({
  author,
  selected,
  onClick,
}: {
  author: AuthorStats;
  selected: boolean;
  onClick: () => void;
}) {
  const lastActive = author.lastCommit
    ? formatDistanceToNow(parseISO(author.lastCommit), { addSuffix: true })
    : "never";

  const netColor =
    author.netLines > 0
      ? "text-green-400"
      : author.netLines < 0
        ? "text-red-400"
        : "text-zinc-400";

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-zinc-900 cursor-pointer transition-all select-none ${
        selected
          ? "border-zinc-500 ring-1 ring-zinc-500"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-4">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: author.color }}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100 truncate">
              {author.name}
            </div>
            <div className="text-xs text-zinc-500 truncate">{author.email}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Commits" value={author.totalCommits} />
          <Stat label="Active days" value={author.activeDays} />
          <Stat
            label="Lines +"
            value={`+${author.linesAdded.toLocaleString()}`}
            highlight="text-green-400"
          />
          <Stat
            label="Lines −"
            value={`−${author.linesDeleted.toLocaleString()}`}
            highlight="text-red-400"
          />
          <Stat
            label="Net"
            value={
              (author.netLines >= 0 ? "+" : "") +
              author.netLines.toLocaleString()
            }
            highlight={netColor}
          />
          <Stat
            label="Avg gap"
            value={formatGap(author.avgTimeBetweenCommitsHours)}
          />
          <Stat label="Files touched" value={author.filesTouched} />
          <Stat
            label="Conventional"
            value={`${author.conventionalCommits.percent}%`}
          />
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-600">
          Last active {lastActive}
        </div>
      </div>
    </div>
  );
}
