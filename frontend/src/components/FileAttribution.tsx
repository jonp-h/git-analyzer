import { useState, useMemo } from "react";
import type { RepoStats } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

export function FileAttribution({ stats }: { stats: RepoStats }) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const authorByKey = useMemo(
    () => new Map(stats.authors.map((a) => [a.key, a])),
    [stats.authors],
  );

  // Per-author: how many files they are the #1 contributor to
  const dominanceCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of stats.fileAttribution) {
      if (!file.authors.length) continue;
      const topKey = file.authors[0].key; // already sorted by linesAdded desc
      map.set(topKey, (map.get(topKey) ?? 0) + 1);
    }
    return map;
  }, [stats.fileAttribution]);

  const authorSummary = useMemo(
    () =>
      stats.authors
        .map((a) => ({ ...a, dominantFiles: dominanceCount.get(a.key) ?? 0 }))
        .sort((a, b) => b.dominantFiles - a.dominantFiles),
    [stats.authors, dominanceCount],
  );

  const maxDominant = useMemo(
    () => Math.max(1, ...authorSummary.map((a) => a.dominantFiles)),
    [authorSummary],
  );

  // Filter + sort by selected author's contribution %
  const filteredFiles = useMemo(() => {
    const q = query.toLowerCase();
    let list = q
      ? stats.fileAttribution.filter((f) => f.file.toLowerCase().includes(q))
      : stats.fileAttribution;

    if (selectedKey) {
      list = list
        .filter((f) => f.authors.some((a) => a.key === selectedKey))
        .slice()
        .sort((a, b) => {
          const pA = a.authors.find((x) => x.key === selectedKey)?.percent ?? 0;
          const pB = b.authors.find((x) => x.key === selectedKey)?.percent ?? 0;
          return pB - pA;
        });
    }

    return list;
  }, [stats.fileAttribution, query, selectedKey]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      {/* Top contributors bar chart — click a row to filter */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between text-xs text-zinc-600 mb-2">
          <span className="text-white">Top contributors</span>
          <span>{stats.fileAttribution.length} files total</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {authorSummary
            .filter((a) => a.dominantFiles > 0)
            .map((a) => {
              const active = selectedKey === a.key;
              const pct = (a.dominantFiles / maxDominant) * 100;
              return (
                <button
                  key={a.key}
                  onClick={() => setSelectedKey(active ? null : a.key)}
                  className="flex items-center gap-2 text-xs w-full cursor-pointer group"
                >
                  <span
                    className="w-20 text-right shrink-0 truncate transition-colors"
                    style={
                      active
                        ? { color: a.color, fontWeight: 600 }
                        : { color: "#71717a" }
                    }
                  >
                    {a.name}
                  </span>
                  <div className="flex-1 h-4 bg-zinc-800/60 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: a.color,
                        opacity: active ? 1 : selectedKey ? 0.25 : 0.6,
                      }}
                    />
                  </div>
                  <span
                    className="w-6 tabular-nums text-right shrink-0 transition-colors"
                    style={
                      active
                        ? { color: a.color, fontWeight: 700 }
                        : { color: "#52525b" }
                    }
                  >
                    {a.dominantFiles}
                  </span>
                </button>
              );
            })}
        </div>
        {selectedKey && (
          <button
            onClick={() => setSelectedKey(null)}
            className="mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            clear filter
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none"
          />
        </div>
      </div>

      <ScrollArea className="h-120">
        {filteredFiles.map((file) => {
          const dominant = file.authors[0];
          const dominantColor =
            authorByKey.get(dominant?.key)?.color ?? "#52525b";
          const selectedData = selectedKey
            ? file.authors.find((a) => a.key === selectedKey)
            : null;
          const selectedColor = selectedKey
            ? (authorByKey.get(selectedKey)?.color ?? "#52525b")
            : null;

          return (
            <div
              key={file.file}
              className="px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900/40"
            >
              {/* Filename row */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: dominantColor }}
                  />
                  <span className="font-mono text-xs text-zinc-300 truncate">
                    {file.file}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedData && selectedColor && (
                    <span
                      className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${selectedColor}25`,
                        color: selectedColor,
                      }}
                    >
                      {selectedData.percent}%
                    </span>
                  )}
                  <span className="text-xs text-zinc-600">
                    {file.totalLines.toLocaleString()} lines
                  </span>
                </div>
              </div>

              {/* Stacked bar */}
              <div className="h-2.5 rounded-full overflow-hidden flex mb-1.5">
                {file.authors.map((fa) => {
                  const color = authorByKey.get(fa.key)?.color ?? "#52525b";
                  const dimmed = selectedKey !== null && fa.key !== selectedKey;
                  return (
                    <div
                      key={fa.key}
                      title={`${fa.name}: ${fa.percent}%`}
                      style={{
                        width: `${fa.percent}%`,
                        backgroundColor: color,
                        opacity: dimmed ? 0.12 : 0.85,
                        transition: "opacity 0.15s",
                      }}
                    />
                  );
                })}
              </div>

              {/* Per-author legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {file.authors.map((fa) => {
                  const color = authorByKey.get(fa.key)?.color ?? "#52525b";
                  const isSelected = fa.key === selectedKey;
                  const dimmed = selectedKey !== null && !isSelected;
                  return (
                    <span
                      key={fa.key}
                      className={`text-xs flex items-center gap-1 transition-opacity ${
                        dimmed ? "opacity-25" : ""
                      }`}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className={
                          isSelected
                            ? "text-zinc-200 font-medium"
                            : "text-zinc-500"
                        }
                      >
                        {fa.name}
                      </span>
                      <span
                        className={
                          isSelected ? "font-semibold" : "text-zinc-700"
                        }
                        style={isSelected ? { color } : {}}
                      >
                        {fa.percent}%
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredFiles.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-600">
            No files match
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
