import { X, CalendarDays } from "lucide-react";
import type { AuthorStats, FilterState } from "../types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  authors: AuthorStats[];
  filterState: FilterState;
  onChange: (f: FilterState) => void;
  totalCommits: number;
  filteredCommits: number;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const PRESETS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
] as const;

export function FilterBar({
  authors,
  filterState,
  onChange,
  totalCommits,
  filteredCommits,
}: FilterBarProps) {
  const { dateFrom, dateTo, authorMode, selectedAuthors } = filterState;

  const isActive = !!(dateFrom || dateTo) || selectedAuthors.length > 0;

  const setField = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onChange({ ...filterState, [key]: val });

  const toggleAuthor = (key: string) => {
    const next = selectedAuthors.includes(key)
      ? selectedAuthors.filter((k) => k !== key)
      : [...selectedAuthors, key];
    setField("selectedAuthors", next);
  };

  const applyPreset = (days: number) => {
    onChange({
      ...filterState,
      dateFrom: daysAgoStr(days),
      dateTo: todayStr(),
    });
  };

  const clearAll = () =>
    onChange({
      dateFrom: null,
      dateTo: null,
      authorMode: "exclude",
      selectedAuthors: [],
    });

  const isPresetActive = (days: number) =>
    dateTo === todayStr() && dateFrom === daysAgoStr(days);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2.5 mt-2.5 border-t border-zinc-800/60">
      {/* Icon */}
      <CalendarDays className="w-3.5 h-3.5 text-zinc-500 shrink-0" />

      {/* Date presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map(({ label, days }) => (
          <button
            key={label}
            onClick={() => applyPreset(days)}
            className={cn(
              "px-2 py-0.5 rounded text-xs font-medium transition-colors",
              isPresetActive(days)
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date range inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={dateFrom ?? ""}
          max={dateTo ?? undefined}
          onChange={(e) => setField("dateFrom", e.target.value || null)}
          className="h-6 px-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 scheme-dark"
        />
        <span className="text-zinc-600 text-xs">→</span>
        <input
          type="date"
          value={dateTo ?? ""}
          min={dateFrom ?? undefined}
          onChange={(e) => setField("dateTo", e.target.value || null)}
          className="h-6 px-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 scheme-dark"
        />
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-zinc-700/70 shrink-0" />

      {/* Author mode toggle */}
      <div className="flex items-center rounded overflow-hidden border border-zinc-700 text-xs">
        {(["exclude", "include"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setField("authorMode", mode)}
            className={cn(
              "px-2 py-0.5 capitalize transition-colors",
              authorMode === mode
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Author pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {authors.map((a) => {
          const active = selectedAuthors.includes(a.key);
          const isFiltered = active;
          return (
            <button
              key={a.key}
              onClick={() => toggleAuthor(a.key)}
              title={a.email}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all",
                isFiltered
                  ? "border-zinc-500 bg-zinc-700/60 text-zinc-200"
                  : "border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: a.color }}
              />
              {a.name}
            </button>
          );
        })}
      </div>

      {/* Filtered commit count + clear */}
      {isActive && (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs text-zinc-500">
            <span className="text-zinc-300 font-medium">
              {filteredCommits.toLocaleString()}
            </span>
            {" / "}
            {totalCommits.toLocaleString()} commits
          </span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Clear all filters"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
