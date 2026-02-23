import { Video, Users, Camera, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { HourlyAnalyticsChart, PersonCountChart } from "@/components/AnalyticsCharts";
import { RecentUploadsTable } from "@/components/RecentUploadsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  deleteVideo,
  downloadReport,
  getAnalytics,
  getVideoDetails,
  type AnalyticsData,
  type VideoDetails,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoDetails | null>(null);
  const [viewLoadingId, setViewLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const response = await getAnalytics();
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
    setViewLoadingId(videoId);
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
    } finally {
      setViewLoadingId(null);
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
          title="Active Cameras"
          value={loading ? "..." : (analytics?.active_cameras ?? 0)}
          change={loading ? "Loading" : "Based on backend activity"}
          changeType="neutral"
          icon={Camera}
        />
        <StatCard
          title="Today's Detections"
          value={loading ? "..." : (analytics?.todays_detections ?? 0)}
          change={loading ? "Loading" : "Updated from today's uploads"}
          changeType="positive"
          icon={Eye}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HourlyAnalyticsChart data={analytics?.hourly_analytics ?? []} />
        <PersonCountChart data={analytics?.person_count_per_video ?? []} />
      </div>

      <RecentUploadsTable
        uploads={analytics?.recent_uploads ?? []}
        onView={handleViewVideo}
        onDelete={handleDeleteVideo}
        deletingId={deletingId}
      />

      {viewLoadingId && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Loading selected video details...
          </CardContent>
        </Card>
      )}

      {selectedVideo && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base">Video Details: {selectedVideo.videoName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-md border border-border p-3">
                <p className="text-muted-foreground">Upload Date</p>
                <p className="font-medium">{selectedVideo.uploadDate}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-muted-foreground">Total Count</p>
                <p className="font-medium">{selectedVideo.personCount}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-muted-foreground">Duration (sec)</p>
                <p className="font-medium">{selectedVideo.details.duration_seconds ?? 0}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-muted-foreground">Peak Count</p>
                <p className="font-medium">{selectedVideo.details.peak_count ?? 0}</p>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium mb-3">Person Count Timeline (per second)</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={selectedVideo.details.counts_per_second ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="second"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: "Duration (s)", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: "Counts", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {selectedVideo.processedVideo && (
              <div className="rounded-md border border-border overflow-hidden bg-black">
                <video src={selectedVideo.processedVideo} controls className="w-full max-h-[420px]" />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
