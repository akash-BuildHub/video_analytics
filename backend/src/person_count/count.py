import cv2
import os
import subprocess
import time
from ultralytics import YOLO

# Load YOLO11n model once from backend/models.
MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "models",
    "yolo11n.pt",
)
model = YOLO(MODEL_PATH)


def process_video(input_path, output_dir, frame_stride=1, progress_callback=None):
    if frame_stride < 1:
        raise ValueError("frame_stride must be >= 1.")

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open input video: {input_path}")

    filename = os.path.basename(input_path)
    stem, _ = os.path.splitext(filename)
    ts = int(time.time())
    temp_output_path = os.path.join(output_dir, f"processed_{stem}_{ts}_raw.mp4")
    output_path = os.path.join(output_dir, f"processed_{stem}_{ts}.mp4")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    source_fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    fps = source_fps if source_fps > 0 else 25.0
    source_total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    output_fps = max(fps / frame_stride, 1.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if width <= 0 or height <= 0:
        cap.release()
        raise ValueError("Invalid video dimensions.")

    out = cv2.VideoWriter(temp_output_path, fourcc, output_fps, (width, height))
    if not out.isOpened():
        cap.release()
        raise ValueError("Could not initialize output video writer.")

    max_person_count = 0
    source_frame_index = 0
    sampled_frames = 0
    second_buckets = {}
    last_reported_progress = -1

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_stride > 1 and source_frame_index % frame_stride != 0:
            source_frame_index += 1
            continue

        results = model(frame, verbose=False)

        person_count = 0

        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                if cls == 0:  # class 0 = person
                    person_count += 1

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])

                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
                    cv2.putText(frame, f"Person {conf:.2f}",
                                (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.5, (0,255,0), 2)

        max_person_count = max(max_person_count, person_count)
        second_index = int(source_frame_index / fps) if fps else sampled_frames
        if second_index not in second_buckets:
            second_buckets[second_index] = {"sum": 0, "frames": 0}
        second_buckets[second_index]["sum"] += person_count
        second_buckets[second_index]["frames"] += 1

        sampled_frames += 1

        cv2.putText(frame, f"Count: {person_count}",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1, (0,0,255), 2)

        out.write(frame)
        source_frame_index += 1

        if progress_callback and source_total_frames > 0:
            progress = int((source_frame_index / source_total_frames) * 100)
            progress = min(100, max(0, progress))
            if progress != last_reported_progress:
                progress_callback(progress, source_frame_index, source_total_frames)
                last_reported_progress = progress

    cap.release()
    out.release()

    # Re-encode to H.264 for broad browser compatibility.
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        temp_output_path,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output_path,
    ]
    result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise ValueError("Failed to encode output video for browser playback.")

    if os.path.exists(temp_output_path):
        os.remove(temp_output_path)

    # Reduce to per-second data for frontend graphing.
    counts_per_second = []
    for second in sorted(second_buckets.keys()):
        bucket = second_buckets[second]
        if bucket["frames"] <= 0:
            continue
        avg_count = round(bucket["sum"] / bucket["frames"])
        counts_per_second.append({"second": second, "count": avg_count})

    processed_source_frames = source_total_frames or source_frame_index
    details = {
        "fps": fps,
        "total_frames": processed_source_frames,
        "sampled_frames": sampled_frames,
        "frame_stride": frame_stride,
        "duration_seconds": round(processed_source_frames / fps, 2) if fps else 0,
        "counts_per_second": counts_per_second,
        "peak_count": max_person_count,
    }

    if progress_callback:
        progress_callback(100, processed_source_frames, processed_source_frames)

    return output_path, max_person_count, details
