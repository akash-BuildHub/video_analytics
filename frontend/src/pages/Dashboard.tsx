import { Video, Users, Camera, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { HourlyAnalyticsChart, ProcessedVideoPanel } from "@/components/AnalyticsCharts";
import { RecentUploadsTable } from "@/components/RecentUploadsTable";
import {
  deleteVideo,
  downloadReport,
  getAnalytics,
  getVideoDetails,
  type AnalyticsData,
  type VideoDetails,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";

interface SelectedVideoHourlyEntry {
  second: number;
  personCount: number;
  uploads: number;
}

type TimelineGranularity = "seconds" | "minutes" | "hours";

interface SelectedVideoTimeline {
  data: SelectedVideoHourlyEntry[];
  ticks: number[];
  endSecond: number;
  granularity: TimelineGranularity;
}

function pickBucketSizeSeconds(durationSeconds: number): { bucketSizeSeconds: number; granularity: TimelineGranularity } {
  if (durationSeconds <= 10 * 60) {
    return { bucketSizeSeconds: 1, granularity: "seconds" };
  }
  if (durationSeconds <= 2 * 60 * 60) {
    return { bucketSizeSeconds: 60, granularity: "minutes" };
  }
  if (durationSeconds <= 12 * 60 * 60) {
    return { bucketSizeSeconds: 30 * 60, granularity: "minutes" };
  }
  if (durationSeconds <= 48 * 60 * 60) {
    return { bucketSizeSeconds: 60 * 60, granularity: "hours" };
  }
  return { bucketSizeSeconds: 2 * 60 * 60, granularity: "hours" };
}

function buildTimelineTicks(endSecond: number, bucketSizeSeconds: number): number[] {
  if (endSecond <= 0) {
    return [0];
  }

  const totalBuckets = Math.max(1, Math.ceil(endSecond / bucketSizeSeconds));
  const targetTickCount = 10;
  const bucketsPerTick = Math.max(1, Math.ceil(totalBuckets / targetTickCount));
  const tickStep = bucketsPerTick * bucketSizeSeconds;

  const ticks: number[] = [];
  for (let t = 0; t <= endSecond; t += tickStep) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== endSecond) {
    ticks.push(endSecond);
  }
  return ticks;
}

function buildSelectedVideoTimeline(video: VideoDetails): SelectedVideoTimeline {
  const timeline = video.details.counts_per_second ?? [];
  const maxSecondFromData = timeline.length > 0 ? Math.max(...timeline.map((p) => p.second)) : 0;
  const durationSeconds = Math.max(
    maxSecondFromData,
    Math.ceil(video.details.duration_seconds ?? 0),
  );
  const { bucketSizeSeconds, granularity } = pickBucketSizeSeconds(durationSeconds);
  const endSecond = Math.max(durationSeconds, 0);

  const bucketAccumulator = new Map<number, { sum: number; count: number }>();
  const countBySecond = new Map<number, number>();
  for (const point of timeline) {
    countBySecond.set(point.second, point.count);
  }

  let lastKnown = timeline.length > 0 ? timeline[0].count : video.personCount;
  for (let second = 0; second <= endSecond; second += 1) {
    const current = countBySecond.get(second);
    if (current !== undefined) {
      lastKnown = current;
    }
    const bucketStart = Math.floor(second / bucketSizeSeconds) * bucketSizeSeconds;
    const bucket = bucketAccumulator.get(bucketStart) ?? { sum: 0, count: 0 };
    bucket.sum += current ?? lastKnown;
    bucket.count += 1;
    bucketAccumulator.set(bucketStart, bucket);
  }

  const data = Array.from(bucketAccumulator.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([second, bucket]) => ({
      second,
      personCount: bucket.count > 0 ? Math.round(bucket.sum / bucket.count) : 0,
      uploads: 1,
    }));

  return {
    data,
    ticks: buildTimelineTicks(endSecond, bucketSizeSeconds),
    endSecond,
    granularity,
  };
}

function formatTimelineTick(value: number, granularity: TimelineGranularity): string {
  if (granularity === "seconds") {
    return `${value}s`;
  }
  if (granularity === "minutes") {
    return `${Math.round(value / 60)}m`;
  }
  return `${Math.round(value / 3600)}h`;
}

function formatTimelineTooltip(value: number, granularity: TimelineGranularity): string {
  if (granularity === "seconds") {
    return `Second ${Math.round(value)}`;
  }
  if (granularity === "minutes") {
    return `Minute ${Math.round(value / 60)}`;
  }
  return `Hour ${Math.round(value / 3600)}`;
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoDetails | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const response = await getAnalytics();
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      response.data.recent_uploads = response.data.recent_uploads.map((upload) => ({
        ...upload,
        processedVideo: upload.processedVideo && !upload.processedVideo.startsWith("http")
          ? `${apiBaseUrl}${upload.processedVideo}`
          : upload.processedVideo,
      }));
      setAnalytics(response.data);
    } catch {
      toast({
        title: "Analytics unavailable",
        description: "Could not load analytics from backend.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleDownloadReport = async () => {
    try {
      const blob = await downloadReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analytics_report.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Report downloaded successfully" });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not connect to the backend. Please ensure the server is running.",
        variant: "destructive",
      });
    }
  };

  const handleViewVideo = async (videoId: string) => {
    try {
      const response = await getVideoDetails(videoId);
      const details = response.data;
      if (details.processedVideo && !details.processedVideo.startsWith("http")) {
        details.processedVideo = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${details.processedVideo}`;
      }
      setSelectedVideo(details);
    } catch {
      toast({
        title: "Unable to load video details",
        description: "Could not fetch detailed data for this video.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    setDeletingId(videoId);
    try {
      await deleteVideo(videoId);
      if (selectedVideo?.id === videoId) {
        setSelectedVideo(null);
      }
      await fetchAnalytics();
      toast({ title: "Video deleted permanently" });
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete this video.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const selectedVideoTimeline = useMemo(
    () => (selectedVideo ? buildSelectedVideoTimeline(selectedVideo) : null),
    [selectedVideo],
  );

  const hourlyChartData = useMemo(
    () => (selectedVideoTimeline ? selectedVideoTimeline.data : (analytics?.hourly_analytics ?? [])),
    [analytics?.hourly_analytics, selectedVideoTimeline],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Video analytics overview</p>
        </div>
        <Button onClick={handleDownloadReport} className="gap-2">
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Videos"
          value={loading ? "..." : (analytics?.total_videos ?? 0)}
          change={loading ? "Loading" : "From processed uploads"}
          changeType="neutral"
          icon={Video}
        />
        <StatCard
          title="Total Person Count"
          value={loading ? "..." : (analytics?.total_persons ?? 0)}
          change={loading ? "Loading" : "Aggregated detections"}
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="Person Count"
          value={loading ? "..." : (selectedVideo?.personCount ?? analytics?.total_persons ?? 0)}
          change={
            loading
              ? "Loading"
              : selectedVideo
                ? `Detected in ${selectedVideo.videoName}`
                : "Across all processed videos"
          }
          changeType="neutral"
          icon={Users}
        />
        <StatCard
          title="Total Frames"
          value={loading ? "..." : (selectedVideo?.details.total_frames ?? 0)}
          change={
            loading
              ? "Loading"
              : selectedVideo
                ? `Captured while processing ${selectedVideo.videoName}`
                : "Select a video to view processed frame count"
          }
          changeType="positive"
          icon={Eye}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HourlyAnalyticsChart
          data={hourlyChartData}
          title={selectedVideo ? `Hourly Analytics (${selectedVideo.videoName})` : "Hourly Analytics"}
          xAxisLabel={
            selectedVideoTimeline
              ? `Video Timeline (${selectedVideoTimeline.granularity})`
              : "Duration"
          }
          xDataKey={selectedVideo ? "second" : "hour"}
          xAxisType={selectedVideo ? "number" : "category"}
          xTicks={selectedVideoTimeline?.ticks}
          xAxisInterval={selectedVideo ? "preserveEnd" : "preserveEnd"}
          xDomain={selectedVideoTimeline ? [0, selectedVideoTimeline.endSecond] : undefined}
          xTickFormatter={
            selectedVideoTimeline
              ? (value) => formatTimelineTick(Number(value), selectedVideoTimeline.granularity)
              : undefined
          }
          tooltipLabelFormatter={
            selectedVideoTimeline
              ? (value) => formatTimelineTooltip(Number(value) || 0, selectedVideoTimeline.granularity)
              : undefined
          }
          yDataKey={selectedVideo ? "personCount" : "detections"}
          yAxisLabel={selectedVideo ? "Person Count" : "Counts"}
          lineName={selectedVideo ? "Person Count" : "Count"}
        />
        <ProcessedVideoPanel
          videoUrl={selectedVideo?.processedVideo}
          videoName={selectedVideo?.videoName}
        />
      </div>

      <RecentUploadsTable
        uploads={analytics?.recent_uploads ?? []}
        onView={handleViewVideo}
        onDelete={handleDeleteVideo}
        deletingId={deletingId}
      />
    </div>
  );
}
