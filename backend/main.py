from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import json
from glob import glob
from datetime import datetime, timedelta
from uuid import uuid4
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

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")


def load_analytics_records():
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
    with open(ANALYTICS_STORE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=True, indent=2)


def append_analytics_record(video_name, person_count, status):
    records = load_analytics_records()
    records.append({
        "id": str(uuid4()),
        "video_name": video_name,
        "person_count": int(person_count),
        "status": status,
        "created_at": datetime.utcnow().isoformat()
    })
    save_analytics_records(records)


def append_video_record(video_name, person_count, status, input_path="", output_path="", details=None):
    records = load_analytics_records()
    records.append({
        "id": str(uuid4()),
        "video_name": video_name,
        "person_count": int(person_count),
        "status": status,
        "created_at": datetime.utcnow().isoformat(),
        "input_path": input_path,
        "output_path": output_path,
        "details": details or {},
    })
    save_analytics_records(records)


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
        })

    return {
        "total_videos": total_videos,
        "total_persons": total_persons,
        "active_cameras": 1 if total_videos > 0 else 0,
        "todays_detections": todays_detections,
        "hourly_analytics": hourly_analytics,
        "person_count_per_video": person_count_per_video,
        "recent_uploads": recent_uploads,
    }


@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Please upload a video file.")

    safe_name = os.path.basename(file.filename or "upload_video.mp4")
    unique_input_name = f"{uuid4().hex}_{safe_name}"
    input_path = os.path.join(UPLOAD_DIR, unique_input_name)

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        output_path, total_count, details = process_video(input_path, OUTPUT_DIR)
        append_video_record(
            video_name=safe_name,
            person_count=total_count,
            status="completed",
            input_path=input_path,
            output_path=output_path,
            details=details,
        )
    except ValueError as exc:
        append_video_record(
            video_name=safe_name,
            person_count=0,
            status="failed",
            input_path=input_path,
        )
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        append_video_record(
            video_name=safe_name,
            person_count=0,
            status="failed",
            input_path=input_path,
        )
        raise HTTPException(status_code=500, detail="Video processing failed.")

    return JSONResponse({
        "message": "Processing completed",
        "total_person_count": total_count,
        "processed_video": f"/outputs/{os.path.basename(output_path)}"
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

    return JSONResponse({
        "success": True,
        "message": "Video deleted permanently",
    })
