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

function buildSelectedVideoHourlyData(video: VideoDetails): SelectedVideoHourlyEntry[] {
  const timeline = video.details.counts_per_second ?? [];
  const maxSecondFromData = timeline.length > 0 ? Math.max(...timeline.map((p) => p.second)) : 0;
  const durationSeconds = Math.max(
    maxSecondFromData,
    Math.ceil(video.details.duration_seconds ?? 0),
  );

  if (timeline.length === 0) {
    return Array.from({ length: durationSeconds + 1 }, (_, second) => ({
      second,
      personCount: video.personCount,
      uploads: 1,
    }));
  }

  const countBySecond = new Map<number, number>();
  timeline.forEach((point) => {
    countBySecond.set(point.second, point.count);
  });

  let lastKnown = 0;
  return Array.from({ length: durationSeconds + 1 }, (_, second) => {
    const current = countBySecond.get(second);
    if (current !== undefined) {
      lastKnown = current;
    }
    return {
      second,
      personCount: current ?? lastKnown,
      uploads: 1,
    };
  });
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

  const hourlyChartData = useMemo(() => {
    if (!selectedVideo) {
      return analytics?.hourly_analytics ?? [];
    }
    return buildSelectedVideoHourlyData(selectedVideo);
  }, [analytics?.hourly_analytics, selectedVideo]);

  const selectedVideoSecondTicks = useMemo(() => {
    if (!selectedVideo) {
      return undefined;
    }
    return (hourlyChartData as SelectedVideoHourlyEntry[]).map((item) => item.second);
  }, [hourlyChartData, selectedVideo]);

  const selectedVideoTimelineEnd = useMemo(() => {
    if (!selectedVideoSecondTicks || selectedVideoSecondTicks.length === 0) {
      return undefined;
    }
    return selectedVideoSecondTicks[selectedVideoSecondTicks.length - 1];
  }, [selectedVideoSecondTicks]);

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
          xAxisLabel={selectedVideo ? "Video Timeline" : "Duration"}
          xDataKey={selectedVideo ? "second" : "hour"}
          xAxisType={selectedVideo ? "number" : "category"}
          xTicks={selectedVideo ? selectedVideoSecondTicks : undefined}
          xAxisInterval={selectedVideo ? 0 : "preserveEnd"}
          xDomain={selectedVideoTimelineEnd !== undefined ? [0, selectedVideoTimelineEnd] : undefined}
          xTickFormatter={selectedVideo ? (value) => `${value}` : undefined}
          tooltipLabelFormatter={
            selectedVideo ? (value) => `Second ${Math.round(Number(value) || 0)}` : undefined
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
