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


def process_video(input_path, output_dir):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open input video: {input_path}")

    filename = os.path.basename(input_path)
    stem, _ = os.path.splitext(filename)
    ts = int(time.time())
    temp_output_path = os.path.join(output_dir, f"processed_{stem}_{ts}_raw.mp4")
    output_path = os.path.join(output_dir, f"processed_{stem}_{ts}.mp4")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if width <= 0 or height <= 0:
        cap.release()
        raise ValueError("Invalid video dimensions.")

    out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
    if not out.isOpened():
        cap.release()
        raise ValueError("Could not initialize output video writer.")

    max_person_count = 0
    frame_counts = []
    frame_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

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
        frame_counts.append({
            "frame": frame_index,
            "count": person_count,
        })
        frame_index += 1

        cv2.putText(frame, f"Count: {person_count}",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1, (0,0,255), 2)

        out.write(frame)

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
    for i in range(0, len(frame_counts), fps):
        second_slice = frame_counts[i:i + fps]
        if not second_slice:
            continue
        avg_count = round(sum(item["count"] for item in second_slice) / len(second_slice))
        counts_per_second.append({
            "second": i // fps,
            "count": avg_count,
        })

    details = {
        "fps": fps,
        "total_frames": len(frame_counts),
        "duration_seconds": round(len(frame_counts) / fps, 2) if fps else 0,
        "counts_per_second": counts_per_second,
        "peak_count": max_person_count,
    }

    return output_path, max_person_count, details
