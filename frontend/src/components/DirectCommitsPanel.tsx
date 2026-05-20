import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { RepoStats } from "../types";

export function DirectCommitsPanel({ stats }: { stats: RepoStats }) {
  const { directMainCommits, authors, totalCommits } = stats;
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Clear highlight if the highlighted author is no longer in the filtered set.
  useEffect(() => {
    if (
      highlighted !== null &&
      !directMainCommits.some(
        (c) => c.authorEmail.toLowerCase() === highlighted,
      )
    ) {
      setHighlighted(null);
    }
  }, [directMainCommits, highlighted]);

  const emailToAuthor = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const a of authors) map.set(a.email.toLowerCase(), a);
    return map;
  }, [authors]);

  // Group by author for the summary chips
  const byAuthor = useMemo(() => {
    const map = new Map<
      string,
      { email: string; name: string; color: string; count: number }
    >();
    for (const c of directMainCommits) {
      const email = c.authorEmail.toLowerCase();
      const author = emailToAuthor.get(email);
      const name = author?.name ?? c.authorName;
      const color = author?.color ?? "#71717a";
      if (map.has(email)) {
        map.get(email)!.count++;
      } else {
        map.set(email, { email, name, color, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [directMainCommits, emailToAuthor]);

  const count = directMainCommits.length;
  const isClean = count === 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isClean
          ? "border-zinc-800 bg-zinc-900/40"
          : "border-red-900/50 bg-red-950/20"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isClean ? "text-zinc-500" : "text-red-400"
          }`}
        >
          Direct commits to main
        </span>
        {/* count / total */}
        <span
          className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
            isClean ? "bg-zinc-800 text-zinc-400" : "bg-red-900/60 text-red-300"
          }`}
        >
          {count}
          <span className="font-normal opacity-60"> / {totalCommits}</span>
        </span>
      </div>

      {isClean ? (
        <p className="text-xs text-zinc-600 mt-2">
          All commits landed via merge — no direct pushes to main.
        </p>
      ) : (
        <>
          {/* Per-author chips — click to highlight */}
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            {byAuthor.map((a) => {
              const active = highlighted === a.email;
              return (
                <button
                  key={a.email}
                  onClick={() => setHighlighted(active ? null : a.email)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    active
                      ? "border-transparent text-zinc-900 font-semibold"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 bg-transparent"
                  }`}
                  style={
                    active
                      ? { backgroundColor: a.color, borderColor: a.color }
                      : {}
                  }
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: active ? "rgba(0,0,0,0.35)" : a.color,
                    }}
                  />
                  {a.name}
                  <span
                    className={`tabular-nums ml-0.5 ${active ? "opacity-70" : "text-zinc-600"}`}
                  >
                    ×{a.count}
                  </span>
                </button>
              );
            })}
            {highlighted && (
              <button
                onClick={() => setHighlighted(null)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors ml-1"
              >
                clear
              </button>
            )}
          </div>

          {/* Commit list */}
          <div className="space-y-0.5">
            {directMainCommits.map((c) => {
              const email = c.authorEmail.toLowerCase();
              const author = emailToAuthor.get(email);
              const color = author?.color ?? "#71717a";
              const dimmed = highlighted !== null && highlighted !== email;
              return (
                <div
                  key={c.hash}
                  className={`flex items-center gap-2 text-xs font-mono rounded px-1 py-0.5 transition-opacity ${
                    dimmed ? "opacity-20" : "opacity-100"
                  }`}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-zinc-600 shrink-0 w-14">
                    {c.hash.slice(0, 7)}
                  </span>
                  <span className="text-zinc-500 shrink-0 w-12">
                    {format(parseISO(c.date), "MMM d")}
                  </span>
                  <span className="text-zinc-300 truncate flex-1">
                    {c.message}
                  </span>
                  <span
                    className="shrink-0 text-[11px] font-sans font-medium px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${color}22`,
                      color,
                    }}
                  >
                    {author?.name ?? c.authorName}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
