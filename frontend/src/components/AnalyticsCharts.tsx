import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HourlyAnalyticsEntry {
  hour?: string;
  personCount?: number;
  detections: number;
  uploads: number;
}

interface HourlyAnalyticsChartProps {
  data: HourlyAnalyticsEntry[];
  title?: string;
  xAxisLabel?: string;
  xDataKey?: "hour" | "second";
  xAxisType?: "category" | "number";
  xTicks?: number[];
  xAxisInterval?: number | "preserveStart" | "preserveEnd" | "preserveStartEnd";
  xDomain?: [number | "dataMin" | "dataMax", number | "dataMin" | "dataMax"];
  xTickFormatter?: (value: number | string) => string;
  tooltipLabelFormatter?: (value: number | string) => string;
  yDataKey?: "detections" | "personCount";
  yAxisLabel?: string;
  lineName?: string;
}

interface ProcessedVideoPanelProps {
  videoUrl?: string;
  videoName?: string;
}

export function HourlyAnalyticsChart({
  data,
  title = "Hourly Analytics",
  xAxisLabel = "Duration",
  xDataKey = "hour",
  xAxisType = "category",
  xTicks,
  xAxisInterval = "preserveEnd",
  xDomain,
  xTickFormatter,
  tooltipLabelFormatter,
  yDataKey = "detections",
  yAxisLabel = "Counts",
  lineName = "Count",
}: HourlyAnalyticsChartProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={xDataKey}
            type={xAxisType}
            ticks={xTicks}
            interval={xAxisInterval}
            tickFormatter={xTickFormatter}
            allowDecimals={false}
            domain={xAxisType === "number" ? (xDomain ?? ["dataMin", "dataMax"]) : undefined}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            label={{ value: xAxisLabel, position: "insideBottom", offset: -5 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            allowDecimals={false}
            label={{ value: yAxisLabel, angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            labelFormatter={tooltipLabelFormatter}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey={yDataKey}
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
            activeDot={{ r: 6, fill: "hsl(var(--chart-1))" }}
            name={lineName}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProcessedVideoPanel({ videoUrl, videoName }: ProcessedVideoPanelProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 animate-fade-in">
      <h3 className="text-sm font-semibold mb-4">Processed Video</h3>
      {videoUrl ? (
        <div className="rounded-md overflow-hidden bg-black">
          <video src={videoUrl} controls className="w-full h-[280px] object-contain" />
        </div>
      ) : (
        <div className="h-[280px] rounded-md border border-dashed border-border grid place-items-center text-sm text-muted-foreground px-4 text-center">
          Click View on a processed record to preview the video here.
        </div>
      )}
      {videoName && <p className="text-xs text-muted-foreground mt-3 truncate">{videoName}</p>}
    </div>
  );
}
