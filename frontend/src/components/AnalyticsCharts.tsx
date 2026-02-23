import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HourlyAnalyticsEntry {
  hour: string;
  detections: number;
  uploads: number;
}

interface PersonCountEntry {
  video: string;
  count: number;
}

interface HourlyAnalyticsChartProps {
  data: HourlyAnalyticsEntry[];
}

interface PersonCountChartProps {
  data: PersonCountEntry[];
}

export function HourlyAnalyticsChart({ data }: HourlyAnalyticsChartProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-4">Hourly Analytics</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            label={{ value: "Duration", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            allowDecimals={false}
            label={{ value: "Counts", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="detections"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
            name="Count"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PersonCountChart({ data }: PersonCountChartProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-4">Person Count per Video</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="video" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Person Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
