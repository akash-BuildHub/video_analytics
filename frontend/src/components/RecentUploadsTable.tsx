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
  processedVideo?: string;
}

interface RecentUploadsTableProps {
  uploads: UploadEntry[];
  onView: (videoId: string) => void;
  onDelete: (videoId: string) => void;
  deletingId?: string | null;
}

export function RecentUploadsTable({ uploads, onView, onDelete, deletingId }: RecentUploadsTableProps) {
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
            <TableHead className="text-xs">Processed Video</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((upload) => (
            <TableRow key={upload.id}>
              <TableCell className="font-mono text-sm">{upload.videoName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{upload.uploadDate}</TableCell>
              <TableCell className="text-sm font-mono text-right">{upload.personCount}</TableCell>
              <TableCell>
                {upload.processedVideo ? (
                  <Button asChild size="sm" variant="secondary">
                    <a href={upload.processedVideo} target="_blank" rel="noreferrer">
                      Play
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Not available</span>
                )}
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
