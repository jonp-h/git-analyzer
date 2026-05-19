import type { RepoStats, CommitInfo } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";

const SIZE_STYLES: Record<string, string> = {
  tiny: "bg-zinc-800 text-zinc-500",
  small: "bg-blue-950 text-blue-400",
  medium: "bg-amber-950 text-amber-400",
  large: "bg-orange-950 text-orange-400",
  dump: "bg-red-950 text-red-400",
};

const TYPE_STYLES: Record<string, string> = {
  feat: "bg-blue-950 text-blue-400",
  fix: "bg-red-950 text-red-400",
  docs: "bg-zinc-800 text-zinc-400",
  style: "bg-purple-950 text-purple-400",
  refactor: "bg-amber-950 text-amber-400",
  test: "bg-green-950 text-green-400",
  chore: "bg-zinc-900 text-zinc-500",
  build: "bg-zinc-800 text-zinc-500",
  ci: "bg-zinc-800 text-zinc-500",
  perf: "bg-yellow-950 text-yellow-400",
  revert: "bg-zinc-800 text-zinc-400",
};

function CommitRow({
  commit,
  stats,
}: {
  commit: CommitInfo;
  stats: RepoStats;
}) {
  const author = stats.authors.find((a) => a.key === commit.authorKey);
  const color = author?.color ?? "#52525b";
  const date = format(parseISO(commit.date), "MMM d, HH:mm");

  return (
    <div className="flex items-start gap-3 py-2.5 px-4 border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
      <div
        className="w-0.5 h-10 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm text-zinc-200 truncate flex-1 leading-snug">
            {commit.message}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-mono ${SIZE_STYLES[commit.size]}`}
            >
              {commit.size}
            </span>
            {commit.conventionalType && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${TYPE_STYLES[commit.conventionalType] ?? "bg-zinc-800 text-zinc-400"}`}
              >
                {commit.conventionalType}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
          <span style={{ color }}>{commit.authorName}</span>
          <span>·</span>
          <span>{date}</span>
          <span>·</span>
          <span className="text-green-600">+{commit.insertions}</span>
          <span className="text-red-600">−{commit.deletions}</span>
          <span className="font-mono text-zinc-700">
            {commit.hash.slice(0, 7)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommitTimeline({ stats }: { stats: RepoStats }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <ScrollArea className="h-[520px]">
        {stats.allCommits.map((commit) => (
          <CommitRow key={commit.hash} commit={commit} stats={stats} />
        ))}
      </ScrollArea>
    </div>
  );
}
