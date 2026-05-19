import { useState, useMemo } from "react";
import type { RepoStats, CommitInfo } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { CommitDiffViewer } from "./CommitDiffViewer";

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
  onClick,
}: {
  commit: CommitInfo;
  stats: RepoStats;
  onClick: () => void;
}) {
  const author = stats.authors.find((a) => a.key === commit.authorKey);
  const color = author?.color ?? "#52525b";
  const date = format(parseISO(commit.date), "MMM d, HH:mm");

  return (
    <button
      className="w-full flex items-start gap-3 py-2.5 px-4 border-b border-zinc-800/50 hover:bg-zinc-900/70 transition-colors text-left"
      onClick={onClick}
    >
      <div
        className="w-0.5 h-10 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm text-zinc-200 truncate flex-1 leading-snug">
            {commit.message}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
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
          {commit.isMerge ? (
            <span className="text-zinc-600 italic">merge</span>
          ) : (
            <>
              <span className="text-green-600">+{commit.insertions}</span>
              <span className="text-red-600">−{commit.deletions}</span>
            </>
          )}
          <span className="font-mono text-zinc-700">
            {commit.hash.slice(0, 7)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function CommitTimeline({ stats }: { stats: RepoStats }) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [diffCommit, setDiffCommit] = useState<CommitInfo | null>(null);

  const toggleAuthor = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (selectedKeys.size === 0) return stats.allCommits;
    return stats.allCommits.filter((c) => selectedKeys.has(c.authorKey));
  }, [stats.allCommits, selectedKeys]);

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {/* Author filter row */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/60">
          {stats.authors.map((a) => {
            const active = selectedKeys.has(a.key);
            return (
              <button
                key={a.key}
                onClick={() => toggleAuthor(a.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                  active
                    ? "bg-zinc-700 text-zinc-100"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                {a.name}
                <span className={active ? "text-zinc-300" : "text-zinc-600"}>
                  {a.totalCommits}
                </span>
              </button>
            );
          })}
          {selectedKeys.size > 0 && (
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="text-xs text-zinc-600 hover:text-zinc-400 px-1"
            >
              clear
            </button>
          )}
          <span className="ml-auto text-xs text-zinc-600 tabular-nums">
            {filtered.length} / {stats.allCommits.length}
          </span>
        </div>

        <ScrollArea className="h-120">
          {filtered.map((commit) => (
            <CommitRow
              key={commit.hash}
              commit={commit}
              stats={stats}
              onClick={() => setDiffCommit(commit)}
            />
          ))}
        </ScrollArea>
      </div>

      {diffCommit && (
        <CommitDiffViewer
          repoName={stats.name}
          commit={diffCommit}
          stats={stats}
          onClose={() => setDiffCommit(null)}
        />
      )}
    </>
  );
}
