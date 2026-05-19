import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { CommitInfo, RepoStats } from "../types";

// ── Diff parser ──────────────────────────────────────────────────────────────

interface DiffLine {
  type: "+" | "-" | " ";
  content: string;
}

interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: Array<{ header: string; lines: DiffLine[] }>;
  isBinary: boolean;
}

function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: { header: string; lines: DiffLine[] } | null = null;

  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      currentFile = { oldPath: "", newPath: "", hunks: [], isBinary: false };
      files.push(currentFile);
      currentHunk = null;
    } else if (line.startsWith("Binary files") && currentFile) {
      currentFile.isBinary = true;
    } else if (line.startsWith("--- ") && currentFile && !currentHunk) {
      const p = line.slice(4);
      currentFile.oldPath =
        p === "/dev/null" ? "/dev/null" : p.replace(/^a\//, "");
    } else if (line.startsWith("+++ ") && currentFile && !currentHunk) {
      const p = line.slice(4);
      currentFile.newPath =
        p === "/dev/null" ? "/dev/null" : p.replace(/^b\//, "");
    } else if (line.startsWith("@@ ") && currentFile) {
      currentHunk = { header: line, lines: [] };
      currentFile.hunks.push(currentHunk);
    } else if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ type: "+", content: line.slice(1) });
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ type: "-", content: line.slice(1) });
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push({ type: " ", content: line.slice(1) });
      }
      // "\ No newline at end of file" and other meta lines are silently ignored
    }
  }

  return files.filter((f) => f.oldPath || f.newPath);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  repoName: string;
  commit: CommitInfo;
  stats: RepoStats;
  onClose: () => void;
}

export function CommitDiffViewer({ repoName, commit, stats, onClose }: Props) {
  const [patch, setPatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPatch(null);
    setError(null);
    fetch(
      `/api/repos/${encodeURIComponent(repoName)}/commit/${encodeURIComponent(commit.hash)}/diff`,
    )
      .then((r) => r.json())
      .then((data: { patch: string } | { error: string }) => {
        if ("error" in data) throw new Error((data as { error: string }).error);
        setPatch((data as { patch: string }).patch);
      })
      .catch((e: unknown) => setError(String(e)));
  }, [repoName, commit.hash]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const files = useMemo(() => (patch ? parsePatch(patch) : []), [patch]);

  const author = stats.authors.find((a) => a.key === commit.authorKey);
  const color = author?.color ?? "#52525b";
  const date = format(parseISO(commit.date), "MMM d, yyyy HH:mm");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden"
        style={{ height: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900 shrink-0 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-zinc-500 shrink-0">
                {commit.hash.slice(0, 7)}
              </span>
              <span className="text-sm text-zinc-200 truncate">
                {commit.message}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
              <span style={{ color }}>{commit.authorName}</span>
              <span>·</span>
              <span>{date}</span>
              {commit.isMerge && (
                <>
                  <span>·</span>
                  <span className="text-zinc-600">merge commit</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {/* Loading */}
          {patch === null && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-6 text-sm text-red-400 font-mono">{error}</div>
          )}

          {/* Empty diff */}
          {patch !== null && files.length === 0 && (
            <div className="p-6 text-sm text-zinc-500 font-mono">
              No text changes in this commit.
            </div>
          )}

          {/* Per-file diff */}
          {files.map((file, fi) => {
            const displayPath =
              file.newPath && file.newPath !== "/dev/null"
                ? file.newPath
                : file.oldPath;
            const ins = file.hunks
              .flatMap((h) => h.lines)
              .filter((l) => l.type === "+").length;
            const del = file.hunks
              .flatMap((h) => h.lines)
              .filter((l) => l.type === "-").length;

            return (
              <div
                key={fi}
                className="border-b border-zinc-800/60 last:border-0"
              >
                {/* File header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/60 sticky top-0 z-10">
                  <span className="font-mono text-xs text-zinc-300 flex-1 truncate">
                    {displayPath}
                  </span>
                  {file.isBinary ? (
                    <span className="text-xs text-zinc-600">binary</span>
                  ) : (
                    <>
                      <span className="text-xs text-green-600 tabular-nums">
                        +{ins}
                      </span>
                      <span className="text-xs text-red-600 tabular-nums">
                        −{del}
                      </span>
                    </>
                  )}
                </div>

                {/* Hunks */}
                {file.isBinary ? (
                  <div className="px-4 py-3 text-xs text-zinc-600 font-mono">
                    Binary file changed
                  </div>
                ) : (
                  file.hunks.map((hunk, hi) => (
                    <div key={hi} className="font-mono text-xs leading-5">
                      {/* Hunk header */}
                      <div className="px-4 py-0.5 bg-blue-950/30 text-blue-500/80 select-none">
                        {hunk.header}
                      </div>
                      {/* Lines */}
                      {hunk.lines.map((line, li) => (
                        <div
                          key={li}
                          className={
                            line.type === "+"
                              ? "bg-green-950/50 text-green-200"
                              : line.type === "-"
                                ? "bg-red-950/50 text-red-200"
                                : "text-zinc-500"
                          }
                        >
                          <span className="inline-block w-5 text-center select-none opacity-50 shrink-0">
                            {line.type === "+"
                              ? "+"
                              : line.type === "-"
                                ? "−"
                                : " "}
                          </span>
                          <span className="whitespace-pre pl-1">
                            {line.content || "\u00a0"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
