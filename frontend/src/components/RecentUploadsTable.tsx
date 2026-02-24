import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface UploadEntry {
  id: string;
  videoName: string;
  uploadDate: string;
  personCount: number;
  status: "completed" | "processing" | "failed";
  processingTimeSeconds?: number;
}

interface RecentUploadsTableProps {
  uploads: UploadEntry[];
  onView: (videoId: string) => void;
  onDelete: (videoId: string) => void;
  deletingId?: string | null;
}

export function RecentUploadsTable({ uploads, onView, onDelete, deletingId }: RecentUploadsTableProps) {
  const formatProcessingTime = (seconds?: number) => {
    if (!seconds || seconds <= 0) {
      return "N/A";
    }

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="bg-card rounded-lg border border-border animate-fade-in">
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-semibold">Processed Videos</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Video Name</TableHead>
            <TableHead className="text-xs">Upload Date</TableHead>
            <TableHead className="text-xs text-right">Person Count</TableHead>
            <TableHead className="text-xs">Processing Time</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((upload) => (
            <TableRow key={upload.id}>
              <TableCell className="font-mono text-sm">{upload.videoName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{upload.uploadDate}</TableCell>
              <TableCell className="text-sm font-mono text-right">{upload.personCount}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatProcessingTime(upload.processingTimeSeconds)}
              </TableCell>
              <TableCell className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onView(upload.id)}>
                  View
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deletingId === upload.id}
                  onClick={() => onDelete(upload.id)}
                >
                  {deletingId === upload.id ? "Deleting..." : "Delete"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {uploads.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground py-6 text-center">
                No uploads available yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
