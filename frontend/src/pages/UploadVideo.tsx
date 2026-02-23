import { useCallback, useRef, useState } from "react";
import { Upload, X, FileVideo, Loader2, CheckCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadVideo } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function UploadVideo() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select a video file.", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const response = await uploadVideo(file);
      setProcessedVideoUrl(response.processed_video);
      toast({
        title: "Processing complete",
        description: `Total person count: ${response.total_person_count}`,
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not connect to the backend. Please ensure the Python server is running.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setProcessedVideoUrl(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Video</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a video file for analysis. Supported formats: MP4, AVI, MOV.
        </p>
      </div>

      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer transition-colors hover:border-primary hover:bg-primary/5"
        >
          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm font-medium">Drag & drop your video here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {/* File info */}
          <div className="flex items-center justify-between bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <FileVideo className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearFile}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Submit / Processed Result */}
          {processedVideoUrl ? (
            <>
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="flex flex-row items-center gap-2 pb-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">Processed Video</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Video analysis is complete and the output has been generated successfully.
                  </p>
                  <Button onClick={clearFile} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Upload Another
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Processed Video Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border overflow-hidden bg-black">
                    <video
                      src={processedVideoUrl}
                      controls
                      className="w-full max-h-[420px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={uploading} className="gap-2">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit for Analysis
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={clearFile} disabled={uploading}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
