import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { BlameLine, RepoStats } from "../types";
import { codeToTokens, type ThemedToken, type BundledLanguage } from "shiki";

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  cs: "csharp",
  cpp: "cpp",
  cc: "cpp",
  c: "c",
  h: "c",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  sh: "bash",
  bash: "bash",
  sql: "sql",
  prisma: "prisma",
  xml: "xml",
  svelte: "svelte",
  vue: "vue",
};

function detectLang(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? "text";
}

interface Props {
  repoName: string;
  filePath: string;
  stats: RepoStats;
  onClose: () => void;
}

export function BlameViewer({ repoName, filePath, stats, onClose }: Props) {
  const [lines, setLines] = useState<BlameLine[] | null>(null);
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tint, setTint] = useState(12); // author background intensity, 0-100%

  useEffect(() => {
    setLines(null);
    setTokens(null);
    setError(null);
    fetch(
      `/api/repos/${encodeURIComponent(repoName)}/blame?file=${encodeURIComponent(filePath)}`,
    )
      .then((r) => r.json())
      .then((data: BlameLine[] | { error: string }) => {
        if ("error" in data) throw new Error((data as { error: string }).error);
        setLines(data as BlameLine[]);
      })
      .catch((e: unknown) => setError(String(e)));
  }, [repoName, filePath]);

  // Tokenize with Shiki once blame lines are loaded.
  // Blame renders immediately in plain text; syntax colours arrive shortly after.
  useEffect(() => {
    if (!lines) return;
    const code = lines.map((l) => l.content).join("\n");
    codeToTokens(code, {
      lang: detectLang(filePath) as BundledLanguage,
      theme: "monokai",
    })
      .then((result) => setTokens(result.tokens))
      .catch(() => setTokens(null)); // unsupported lang → keep plain text
  }, [lines, filePath]);

  const emailToColor = useMemo(
    () => new Map(stats.authors.map((a) => [a.email.toLowerCase(), a.color])),
    [stats.authors],
  );
  const emailToName = useMemo(
    () => new Map(stats.authors.map((a) => [a.email.toLowerCase(), a.name])),
    [stats.authors],
  );

  const authorsInFile = useMemo(() => {
    if (!lines) return [];
    const seen = new Map<
      string,
      { name: string; color: string; count: number }
    >();
    for (const line of lines) {
      const key = line.authorEmail.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, {
          name: emailToName.get(key) ?? line.authorName,
          color: emailToColor.get(key) ?? "#71717a",
          count: 0,
        });
      }
      seen.get(key)!.count++;
    }
    return [...seen.values()].sort((a, b) => b.count - a.count);
  }, [lines, emailToColor, emailToName]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <span className="font-mono text-xs text-zinc-400 truncate">
            {filePath}
          </span>
          <div className="ml-4 flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 select-none">
              <span>tint</span>
              <input
                type="range"
                min={0}
                max={40}
                value={tint}
                onChange={(e) => setTint(Number(e.target.value))}
                className="w-20 accent-zinc-400"
              />
              <span className="w-6 tabular-nums text-zinc-400">{tint}%</span>
            </label>
            <button
              onClick={onClose}
              className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Author legend */}
        {authorsInFile.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
            {authorsInFile.map((a) => (
              <span key={a.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: a.color }}
                />
                <span className="text-zinc-300">{a.name}</span>
                <span className="text-zinc-600 tabular-nums">
                  {a.count} lines
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Code area */}
        <div className="flex-1 overflow-auto">
          {/* Loading */}
          {!lines && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-6 text-sm text-red-400 font-mono">{error}</div>
          )}

          {/* Lines */}
          {lines && (
            <div className="inline-block min-w-full font-mono text-xs leading-5">
              {lines.map((line, i) => {
                const email = line.authorEmail.toLowerCase();
                const color = emailToColor.get(email) ?? "#52525b";
                const name = emailToName.get(email) ?? line.authorName;
                return (
                  <div
                    key={i}
                    className="flex items-stretch group"
                    style={{
                      backgroundColor: `${color}${Math.round(tint * 2.55)
                        .toString(16)
                        .padStart(2, "0")}`,
                    }}
                    title={name}
                  >
                    {/* Author colour bar */}
                    <div
                      className="w-1 shrink-0"
                      style={{ backgroundColor: color, opacity: 0.65 }}
                    />
                    {/* Line number */}
                    <span className="w-12 shrink-0 text-right pr-3 py-0.5 text-zinc-700 select-none">
                      {i + 1}
                    </span>
                    {/* Code — syntax tokens when ready, plain text as fallback */}
                    <span className="pl-3 pr-8 py-0.5 whitespace-pre">
                      {tokens ? (
                        (tokens[i] ?? []).map((tok, j) => (
                          <span key={j} style={{ color: tok.color }}>
                            {tok.content}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-200">
                          {line.content || "\u00a0"}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
