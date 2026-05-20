import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  parseISO,
  format,
  startOfWeek,
  addWeeks,
  isWithinInterval,
  min,
  max,
} from "date-fns";
import type { IssueDetail } from "../types";

interface WeekPoint {
  week: string;
  opened: number;
  closed: number;
}

function buildVelocityData(issues: IssueDetail[]): WeekPoint[] {
  if (issues.length === 0) return [];

  const allDates = [
    ...issues.map((i) => parseISO(i.createdAt)),
    ...issues.filter((i) => i.closedAt).map((i) => parseISO(i.closedAt!)),
  ];

  const earliest = min(allDates);
  const latest = max(allDates);
  const weekStart = startOfWeek(earliest, { weekStartsOn: 1 });

  const points: WeekPoint[] = [];
  let cursor = weekStart;

  while (cursor <= latest) {
    const weekEnd = addWeeks(cursor, 1);
    const interval = { start: cursor, end: weekEnd };

    points.push({
      week: format(cursor, "MMM d"),
      opened: issues.filter((i) =>
        isWithinInterval(parseISO(i.createdAt), interval),
      ).length,
      closed: issues.filter(
        (i) => i.closedAt && isWithinInterval(parseISO(i.closedAt), interval),
      ).length,
    });

    cursor = weekEnd;
  }

  return points;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function VelocityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg">
      <p className="text-zinc-400 mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IssueVelocityChart({ issues }: { issues: IssueDetail[] }) {
  const data = useMemo(() => buildVelocityData(issues), [issues]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4">No issue data to chart.</p>
    );
  }

  // Only show every Nth label to avoid crowding
  const tickInterval = Math.max(1, Math.floor(data.length / 12));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 16, left: -16, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="week"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<VelocityTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="opened"
          name="Opened"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="closed"
          name="Closed"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
