import type { RepoStats } from "../types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

export function ContributionChart({ stats }: { stats: RepoStats }) {
  const data = stats.weeklyActivity.map((week) => {
    const point: Record<string, number | string> = {
      week: format(parseISO(week.week), "MMM d"),
    };
    for (const author of stats.authors) {
      point[author.key] = (week[author.key] as number) || 0;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="week"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
          formatter={(value, key) => {
            const author = stats.authors.find((a) => a.key === key);
            return [value, author?.name ?? key];
          }}
        />
        <Legend
          formatter={(value) => {
            const author = stats.authors.find((a) => a.key === value);
            return (
              <span style={{ color: author?.color, fontSize: "12px" }}>
                {author?.name ?? value}
              </span>
            );
          }}
        />
        {stats.authors.map((author) => (
          <Area
            key={author.key}
            type="monotone"
            dataKey={author.key}
            stackId="1"
            stroke={author.color}
            fill={author.color}
            fillOpacity={0.25}
            strokeWidth={1.5}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
