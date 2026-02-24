from datetime import datetime, timedelta
from glob import glob
from threading import RLock
from uuid import uuid4
import json
import os
import shutil

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from src.person_count.count import process_video

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev-only CORS policy.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
ANALYTICS_STORE = os.path.join(OUTPUT_DIR, "analytics_data.json")
FRAME_STRIDE = max(1, int(os.getenv("VIDEO_FRAME_STRIDE", "3")))
SUPPORTED_VIDEO_EXTENSIONS = {
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".webm",
    ".flv",
    ".wmv",
    ".m4v",
    ".mpg",
    ".mpeg",
    ".3gp",
    ".ts",
    ".m2ts",
}

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

records_lock = RLock()
jobs_lock = RLock()
JOBS = {}


def load_analytics_records():
    with records_lock:
        if not os.path.exists(ANALYTICS_STORE):
            return []

        try:
            with open(ANALYTICS_STORE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except json.JSONDecodeError:
            pass

        return []


def save_analytics_records(records):
    with records_lock:
        with open(ANALYTICS_STORE, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=True, indent=2)


def append_video_record(video_name, person_count, status, input_path="", output_path="", details=None, record_id=""):
    record_id = record_id or str(uuid4())
    with records_lock:
        records = load_analytics_records()
        records.append({
            "id": record_id,
            "video_name": video_name,
            "person_count": int(person_count),
            "status": status,
            "created_at": datetime.utcnow().isoformat(),
            "input_path": input_path,
            "output_path": output_path,
            "details": details or {},
        })
        save_analytics_records(records)
    return record_id


def update_video_record(record_id, **updates):
    with records_lock:
        records = load_analytics_records()
        updated = False
        for record in records:
            if record.get("id") == record_id:
                record.update(updates)
                updated = True
                break

        if updated:
            save_analytics_records(records)

        return updated


def set_job_state(job_id, **updates):
    with jobs_lock:
        current = JOBS.get(job_id, {"job_id": job_id})
        current.update(updates)
        current["updated_at"] = datetime.utcnow().isoformat()
        JOBS[job_id] = current


def get_job_state(job_id):
    with jobs_lock:
        state = JOBS.get(job_id)
        return dict(state) if state else None


def is_supported_video_upload(file: UploadFile):
    filename = os.path.basename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()
    content_type = (file.content_type or "").lower()
    return (
        content_type.startswith("video/")
        or extension in SUPPORTED_VIDEO_EXTENSIONS
    )


def resolve_processed_video_path(record):
    output_path = record.get("output_path", "")
    if output_path and os.path.exists(output_path):
        return f"/outputs/{os.path.basename(output_path)}"

    # Best effort fallback for legacy records without output_path metadata.
    video_name = record.get("video_name", "")
    video_stem = os.path.splitext(os.path.basename(video_name))[0]
    if not video_stem:
        return ""

    pattern = os.path.join(OUTPUT_DIR, f"processed_*{video_stem}*.mp4")
    candidates = sorted(glob(pattern), key=os.path.getmtime, reverse=True)
    if not candidates:
        return ""

    return f"/outputs/{os.path.basename(candidates[0])}"


def build_analytics_payload():
    records = load_analytics_records()

    completed_records = [r for r in records if r.get("status") == "completed"]
    total_videos = len(completed_records)
    total_persons = sum(int(r.get("person_count", 0)) for r in completed_records)
    total_processing_time_seconds = sum(
        float((r.get("details", {}) or {}).get("duration_seconds") or 0)
        for r in completed_records
    )

    today = datetime.utcnow().date()
    todays_detections = 0
    for r in completed_records:
        try:
            created_day = datetime.fromisoformat(r.get("created_at", "")).date()
        except ValueError:
            continue
        if created_day == today:
            todays_detections += int(r.get("person_count", 0))

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    hourly_analytics = []
    for hours_ago in range(11, -1, -1):
        hour_start = now - timedelta(hours=hours_ago)
        hour_end = hour_start + timedelta(hours=1)
        hour_uploads = 0
        hour_detections = 0

        for r in completed_records:
            try:
                created_at = datetime.fromisoformat(r.get("created_at", ""))
            except ValueError:
                continue
            if hour_start <= created_at < hour_end:
                hour_uploads += 1
                hour_detections += int(r.get("person_count", 0))

        hourly_analytics.append({
            "hour": hour_start.strftime("%H:00"),
            "detections": hour_detections,
            "uploads": hour_uploads,
        })

    person_count_per_video = [
        {
            "video": r.get("video_name", "unknown"),
            "count": int(r.get("person_count", 0)),
        }
        for r in completed_records[-10:]
    ]

    recent_uploads = []
    for r in reversed(records[-10:]):
        created_at = r.get("created_at", "")
        upload_date = created_at.split("T")[0] if "T" in created_at else created_at
        recent_uploads.append({
            "id": r.get("id", ""),
            "videoName": r.get("video_name", "unknown"),
            "uploadDate": upload_date,
            "personCount": int(r.get("person_count", 0)),
            "status": r.get("status", "completed"),
            "processedVideo": resolve_processed_video_path(r),
            "processingTimeSeconds": float((r.get("details", {}) or {}).get("duration_seconds") or 0),
        })

    return {
        "total_videos": total_videos,
        "total_persons": total_persons,
        "total_processing_time_seconds": total_processing_time_seconds,
        "active_cameras": 1 if total_videos > 0 else 0,
        "todays_detections": todays_detections,
        "hourly_analytics": hourly_analytics,
        "person_count_per_video": person_count_per_video,
        "recent_uploads": recent_uploads,
    }


def process_video_job(job_id, record_id, safe_name, input_path):
    set_job_state(
        job_id,
        record_id=record_id,
        video_name=safe_name,
        status="processing",
        progress=0,
        frame_stride=FRAME_STRIDE,
        started_at=datetime.utcnow().isoformat(),
    )

    def on_progress(progress, processed_frames, total_frames):
        set_job_state(
            job_id,
            status="processing",
            progress=progress,
            processed_frames=processed_frames,
            total_frames=total_frames,
        )

    try:
        output_path, total_count, details = process_video(
            input_path,
            OUTPUT_DIR,
            frame_stride=FRAME_STRIDE,
            progress_callback=on_progress,
        )
        update_video_record(
            record_id,
            person_count=total_count,
            status="completed",
            output_path=output_path,
            details=details,
            completed_at=datetime.utcnow().isoformat(),
        )
        set_job_state(
            job_id,
            status="completed",
            progress=100,
            total_person_count=total_count,
            processed_video=f"/outputs/{os.path.basename(output_path)}",
            completed_at=datetime.utcnow().isoformat(),
        )
    except ValueError as exc:
        update_video_record(
            record_id,
            person_count=0,
            status="failed",
            details={"error": str(exc)},
            completed_at=datetime.utcnow().isoformat(),
        )
        set_job_state(
            job_id,
            status="failed",
            error=str(exc),
            completed_at=datetime.utcnow().isoformat(),
        )
    except Exception:
        update_video_record(
            record_id,
            person_count=0,
            status="failed",
            details={"error": "Video processing failed."},
            completed_at=datetime.utcnow().isoformat(),
        )
        set_job_state(
            job_id,
            status="failed",
            error="Video processing failed.",
            completed_at=datetime.utcnow().isoformat(),
        )


@app.post("/upload-video")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not is_supported_video_upload(file):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a common video format such as MP4, AVI, MOV, MKV, WEBM, FLV, WMV, or MPEG.",
        )

    safe_name = os.path.basename(file.filename or "upload_video.mp4")
    unique_input_name = f"{uuid4().hex}_{safe_name}"
    input_path = os.path.join(UPLOAD_DIR, unique_input_name)

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    job_id = str(uuid4())
    record_id = append_video_record(
        video_name=safe_name,
        person_count=0,
        status="processing",
        input_path=input_path,
        record_id=job_id,
    )

    set_job_state(
        job_id,
        record_id=record_id,
        video_name=safe_name,
        status="processing",
        progress=0,
        frame_stride=FRAME_STRIDE,
        started_at=datetime.utcnow().isoformat(),
    )
    background_tasks.add_task(process_video_job, job_id, record_id, safe_name, input_path)

    return JSONResponse({
        "message": "Video accepted for processing",
        "job_id": job_id,
        "status": "processing",
        "frame_stride": FRAME_STRIDE,
    })


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = get_job_state(job_id)
    if not job:
        records = load_analytics_records()
        record = next((r for r in records if r.get("id") == job_id), None)
        if not record:
            raise HTTPException(status_code=404, detail="Job not found.")

        job = {
            "job_id": job_id,
            "record_id": job_id,
            "video_name": record.get("video_name", "unknown"),
            "status": record.get("status", "failed"),
            "progress": 100 if record.get("status") == "completed" else 0,
            "total_person_count": int(record.get("person_count", 0)),
            "processed_video": resolve_processed_video_path(record),
            "error": record.get("details", {}).get("error"),
            "updated_at": datetime.utcnow().isoformat(),
        }

    return JSONResponse({
        "success": True,
        "message": "Job status fetched successfully",
        "data": job,
    })


@app.get("/api/analytics")
async def get_analytics():
    payload = build_analytics_payload()
    return JSONResponse({
        "success": True,
        "message": "Analytics fetched successfully",
        "data": payload,
    })


@app.get("/api/analytics/report")
async def download_analytics_report():
    payload = build_analytics_payload()
    rows = ["video_name,upload_date,person_count,status"]
    for item in payload["recent_uploads"]:
        rows.append(
            f'{item["videoName"]},{item["uploadDate"]},{item["personCount"]},{item["status"]}'
        )

    csv_data = "\n".join(rows) + "\n"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="analytics_report.csv"'},
    )


@app.get("/api/videos/{video_id}")
async def get_video_details(video_id: str):
    records = load_analytics_records()
    record = next((r for r in records if r.get("id") == video_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Video record not found.")

    processed_video = resolve_processed_video_path(record)

    created_at = record.get("created_at", "")
    upload_date = created_at.split("T")[0] if "T" in created_at else created_at

    return JSONResponse({
        "success": True,
        "message": "Video details fetched successfully",
        "data": {
            "id": record.get("id", ""),
            "videoName": record.get("video_name", "unknown"),
            "uploadDate": upload_date,
            "personCount": int(record.get("person_count", 0)),
            "status": record.get("status", "failed"),
            "processedVideo": processed_video,
            "details": record.get("details", {}),
        },
    })


@app.delete("/api/videos/{video_id}")
async def delete_video(video_id: str):
    with records_lock:
        records = load_analytics_records()
        record_index = next((idx for idx, r in enumerate(records) if r.get("id") == video_id), None)
        if record_index is None:
            raise HTTPException(status_code=404, detail="Video record not found.")

        record = records[record_index]
        input_path = record.get("input_path", "")
        output_path = record.get("output_path", "")

        if input_path and os.path.exists(input_path):
            os.remove(input_path)

        if output_path and os.path.exists(output_path):
            os.remove(output_path)

        records.pop(record_index)
        save_analytics_records(records)

    with jobs_lock:
        JOBS.pop(video_id, None)

    return JSONResponse({
        "success": True,
        "message": "Video deleted permanently",
    })
