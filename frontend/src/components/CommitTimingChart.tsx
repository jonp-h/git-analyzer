import { useMemo } from "react";
import type { RepoStats } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#a1a1aa", marginBottom: "4px" },
};

const AXIS_TICK = { fill: "#71717a", fontSize: 11 };

export function CommitTimingChart({ stats }: { stats: RepoStats }) {
  const authorByKey = useMemo(
    () => new Map(stats.authors.map((a) => [a.key, a])),
    [stats],
  );

  const tooltipFormatter = (
    value: unknown,
    key: unknown,
  ): [unknown, string] => {
    const k = String(key ?? "");
    return [value, authorByKey.get(k)?.name ?? k];
  };

  const legendFormatter = (value: string) => {
    const author = authorByKey.get(value);
    return (
      <span style={{ color: author?.color, fontSize: "12px" }}>
        {author?.name ?? value}
      </span>
    );
  };

  // Hour-of-day distribution per author
  const hourData = useMemo(() => {
    const grid: Record<number, Record<string, number>> = {};
    for (let h = 0; h < 24; h++) grid[h] = {};

    for (const commit of stats.allCommits) {
      // Parse local hour from the ISO timestamp
      const h = new Date(commit.date).getHours();
      grid[h][commit.authorKey] = (grid[h][commit.authorKey] || 0) + 1;
    }

    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      ...grid[h],
    }));
  }, [stats]);

  // Day-of-week distribution per author
  const dayData = useMemo(() => {
    const grid: Record<number, Record<string, number>> = {};
    for (let d = 0; d < 7; d++) grid[d] = {};

    for (const commit of stats.allCommits) {
      const d = new Date(commit.date).getDay();
      grid[d][commit.authorKey] = (grid[d][commit.authorKey] || 0) + 1;
    }

    return DAYS.map((day, d) => ({ day, ...grid[d] }));
  }, [stats]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Hour of day */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Commits by hour of day</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={hourData}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="hour"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend formatter={legendFormatter} />
            {stats.authors.map((a) => (
              <Bar
                key={a.key}
                dataKey={a.key}
                stackId="hour"
                fill={a.color}
                fillOpacity={0.85}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day of week */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Commits by day of week</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={dayData}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="day"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend formatter={legendFormatter} />
            {stats.authors.map((a) => (
              <Bar
                key={a.key}
                dataKey={a.key}
                stackId="day"
                fill={a.color}
                fillOpacity={0.85}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
