import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { RepoStats } from "../types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  format,
  parseISO,
  addDays,
  getISOWeek,
  startOfISOWeek,
} from "date-fns";

function weekLabel(dateStr: string): string {
  const start = parseISO(dateStr);
  const end = addDays(start, 6);
  const num = getISOWeek(start);
  const startLabel = format(start, "MMM d");
  const endLabel =
    format(start, "MMM") === format(end, "MMM")
      ? format(end, "d")
      : format(end, "MMM d");
  return `${startLabel}-${endLabel} · W${num}`;
}

type ChartView = "stacked" | "bars" | "lines" | "cumulative";

const VIEWS: { key: ChartView; label: string; title: string }[] = [
  {
    key: "stacked",
    label: "Stacked",
    title: "Stacked area — relative share per week",
  },
  {
    key: "bars",
    label: "Weekly bars",
    title: "Grouped bars — lines added per author per week",
  },
  {
    key: "lines",
    label: "Trend lines",
    title: "Trend lines — weekly contribution per author",
  },
  {
    key: "cumulative",
    label: "Cumulative",
    title: "Cumulative lines — running total per author",
  },
];

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

export function ContributionChart({ stats }: { stats: RepoStats }) {
  const [view, setView] = useState<ChartView>("bars");

  const nameOf = (key: string) =>
    stats.authors.find((a) => a.key === key)?.name ?? key;

  // Recharts Formatter generics are overly strict — cast to avoid false errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter: any = (value: unknown, key: unknown) => [
    value as ReactNode,
    nameOf(String(key ?? "")),
  ];

  const legendFormatter = (value: string) => {
    const author = stats.authors.find((a) => a.key === value);
    return (
      <span style={{ color: author?.color, fontSize: "12px" }}>
        {author?.name ?? value}
      </span>
    );
  };

  // Weekly data — store raw ISO date so tickFormatter can compute the label
  const weeklyData = useMemo(
    () =>
      stats.weeklyActivity.map((week) => {
        const point: Record<string, number | string> = { week: week.week };
        for (const a of stats.authors) {
          point[a.key] = (week[a.key] as number) || 0;
        }
        return point;
      }),
    [stats],
  );

  // Cumulative running totals per author
  const cumulativeData = useMemo(() => {
    const totals: Record<string, number> = {};
    return stats.weeklyActivity.map((week) => {
      const point: Record<string, number | string> = { week: week.week };
      for (const a of stats.authors) {
        totals[a.key] = (totals[a.key] || 0) + ((week[a.key] as number) || 0);
        point[a.key] = totals[a.key];
      }
      return point;
    });
  }, [stats]);

  const mergeWeeks = useMemo(() => {
    const seen = new Set<string>();
    for (const c of stats.allCommits) {
      if (c.isMerge) {
        seen.add(format(startOfISOWeek(parseISO(c.date)), "yyyy-MM-dd"));
      }
    }
    return [...seen];
  }, [stats]);

  const activeTitle = VIEWS.find((v) => v.key === view)?.title ?? "";

  const sharedAxisProps = {
    xAxis: (
      <XAxis
        dataKey="week"
        tickFormatter={weekLabel}
        tick={{ ...AXIS_TICK, textAnchor: "end" }}
        angle={-35}
        height={52}
        tickLine={false}
        axisLine={false}
        minTickGap={60}
      />
    ),
    yAxis: (
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={45} />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />,
  };

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-zinc-500">{activeTitle}</p>
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                view === v.key
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stacked area */}
      {view === "stacked" && (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={weeklyData}
            margin={{ top: 6, right: 10, left: 0, bottom: 0 }}
          >
            {sharedAxisProps.grid}
            {sharedAxisProps.xAxis}
            {sharedAxisProps.yAxis}
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(l) => weekLabel(String(l ?? ""))}
              formatter={tooltipFormatter}
            />
            <Legend formatter={legendFormatter} />
            {mergeWeeks.map((week) => (
              <ReferenceLine
                key={`m-${week}`}
                x={week}
                stroke="#6366f1"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            ))}
            {stats.authors.map((a) => (
              <Area
                key={a.key}
                type="monotone"
                dataKey={a.key}
                stackId="1"
                stroke={a.color}
                fill={a.color}
                fillOpacity={0.3}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Grouped bars */}
      {view === "bars" && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={weeklyData}
            margin={{ top: 6, right: 10, left: 0, bottom: 0 }}
            barGap={2}
          >
            {sharedAxisProps.grid}
            {sharedAxisProps.xAxis}
            {sharedAxisProps.yAxis}
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(l) => weekLabel(String(l ?? ""))}
              formatter={tooltipFormatter}
            />
            <Legend formatter={legendFormatter} />
            {mergeWeeks.map((week) => (
              <ReferenceLine
                key={`m-${week}`}
                x={week}
                stroke="#6366f1"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            ))}
            {stats.authors.map((a) => (
              <Bar
                key={a.key}
                dataKey={a.key}
                fill={a.color}
                fillOpacity={0.85}
                radius={[2, 2, 0, 0]}
                maxBarSize={24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Trend lines */}
      {view === "lines" && (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={weeklyData}
            margin={{ top: 6, right: 10, left: 0, bottom: 0 }}
          >
            {sharedAxisProps.grid}
            {sharedAxisProps.xAxis}
            {sharedAxisProps.yAxis}
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(l) => weekLabel(String(l ?? ""))}
              formatter={tooltipFormatter}
            />
            <Legend formatter={legendFormatter} />
            {mergeWeeks.map((week) => (
              <ReferenceLine
                key={`m-${week}`}
                x={week}
                stroke="#6366f1"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            ))}
            {stats.authors.map((a) => (
              <Line
                key={a.key}
                type="monotone"
                dataKey={a.key}
                stroke={a.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Cumulative */}
      {view === "cumulative" && (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={cumulativeData}
            margin={{ top: 6, right: 10, left: 0, bottom: 0 }}
          >
            {sharedAxisProps.grid}
            {sharedAxisProps.xAxis}
            {sharedAxisProps.yAxis}
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(l) => weekLabel(String(l ?? ""))}
              formatter={tooltipFormatter}
            />
            <Legend formatter={legendFormatter} />
            {mergeWeeks.map((week) => (
              <ReferenceLine
                key={`m-${week}`}
                x={week}
                stroke="#6366f1"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            ))}
            {stats.authors.map((a) => (
              <Line
                key={a.key}
                type="monotone"
                dataKey={a.key}
                stroke={a.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
