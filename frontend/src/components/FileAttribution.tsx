import { useState, useMemo } from "react";
import type { RepoStats } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

export function FileAttribution({ stats }: { stats: RepoStats }) {
  const [query, setQuery] = useState("");

  const authorByKey = useMemo(
    () => new Map(stats.authors.map((a) => [a.key, a])),
    [stats.authors],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? stats.fileAttribution.filter((f) => f.file.toLowerCase().includes(q))
      : stats.fileAttribution;
  }, [stats.fileAttribution, query]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      {/* Search bar */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none"
          />
        </div>
      </div>

      <ScrollArea className="h-[480px]">
        {filtered.map((file) => (
          <div
            key={file.file}
            className="px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900/40"
          >
            {/* Filename + total */}
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="font-mono text-xs text-zinc-300 truncate">
                {file.file}
              </span>
              <span className="text-xs text-zinc-600 flex-shrink-0">
                {file.totalLines.toLocaleString()} lines
              </span>
            </div>

            {/* Stacked bar */}
            <div className="h-2 rounded-full overflow-hidden flex mb-1.5">
              {file.authors.map((fa) => {
                const author = authorByKey.get(fa.key);
                return (
                  <div
                    key={fa.key}
                    style={{
                      width: `${fa.percent}%`,
                      backgroundColor: author?.color ?? "#52525b",
                      opacity: 0.8,
                    }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {file.authors.map((fa) => {
                const author = authorByKey.get(fa.key);
                return (
                  <span
                    key={fa.key}
                    className="text-xs flex items-center gap-1"
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: author?.color ?? "#52525b" }}
                    />
                    <span className="text-zinc-500">{fa.name}</span>
                    <span className="text-zinc-700">{fa.percent}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-600">
            No files match
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
