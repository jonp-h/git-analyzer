import type { AuthorStats } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const SIZES = [
  { key: "tiny", label: "Tiny\n1-10", color: "#52525b" },
  { key: "small", label: "Small\n11-50", color: "#3b82f6" },
  { key: "medium", label: "Medium\n51-200", color: "#f59e0b" },
  { key: "large", label: "Large\n201-500", color: "#f97316" },
  { key: "dump", label: "Dump\n500+", color: "#ef4444" },
];

export function CommitSizeChart({ author }: { author: AuthorStats }) {
  const data = SIZES.map((s) => ({
    name: s.key,
    count: (author.commitSizeBuckets as Record<string, number>)[s.key] ?? 0,
    color: s.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value) => [value, "Commits"]}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
