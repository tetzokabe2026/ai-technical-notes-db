#!/usr/bin/env python3
"""Convert all FIT files in a folder to CSV files."""

import csv
import glob
import sys
from datetime import datetime, timedelta, timezone

from fitparse import FitFile

JST = timezone(timedelta(hours=9))
GARMIN_EPOCH_OFFSET = 631065600  # seconds between Unix epoch and Garmin epoch (1989-12-31)

# Sleep stage mapping (Garmin)
SLEEP_STAGES = {0: "unmeasurable", 1: "awake", 2: "light", 3: "deep", 5: "REM"}


def garmin_ts_to_jst(garmin_ts: int) -> str:
    unix = garmin_ts + GARMIN_EPOCH_OFFSET
    return datetime.fromtimestamp(unix, tz=JST).strftime("%Y-%m-%d %H:%M:%S")


def dt_to_jst(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(JST).strftime("%Y-%m-%d %H:%M:%S")


def convert_wellness(path: str, out: str):
    fit = FitFile(path)
    rows = []
    for msg in fit.get_messages("stress_level"):
        d = {f.name: f.value for f in msg.fields}
        ts = d.get("stress_level_time")
        if ts:
            rows.append({
                "timestamp_jst": dt_to_jst(ts),
                "stress_level": d.get("stress_level_value", ""),
                "hrv_rmssd": d.get("unknown_2", ""),
                "hrv_sdrr": d.get("unknown_3", ""),
            })
    rows.sort(key=lambda r: r["timestamp_jst"])
    write_csv(out, ["timestamp_jst", "stress_level", "hrv_rmssd", "hrv_sdrr"], rows)
    return len(rows)


def convert_hrv_status(path: str, out: str):
    fit = FitFile(path)
    rows = []
    for msg in fit.get_messages():
        if msg.name == "unknown_371":
            d = {f.name: f.value for f in msg.fields}
            garmin_ts = d.get("unknown_253")
            hrv_raw = d.get("unknown_0")
            if garmin_ts and hrv_raw is not None:
                rows.append({
                    "timestamp_jst": garmin_ts_to_jst(garmin_ts),
                    "hrv_raw": hrv_raw,
                    "hrv_ms": round(hrv_raw / 16, 1),  # Garmin stores in 1/16 ms units
                })
    rows.sort(key=lambda r: r["timestamp_jst"])
    write_csv(out, ["timestamp_jst", "hrv_raw", "hrv_ms"], rows)
    return len(rows)


def convert_sleep_data(path: str, out: str):
    fit = FitFile(path)
    rows = []

    # Session window from event messages
    session = {}
    for msg in fit.get_messages("event"):
        d = {f.name: f.value for f in msg.fields}
        ts = d.get("timestamp")
        etype = d.get("event_type")
        if ts and d.get("event") == 74:
            key = "sleep_start" if etype == "start" else "sleep_end"
            session[key] = dt_to_jst(ts)

    if session:
        rows.append({
            "timestamp_jst": session.get("sleep_start", ""),
            "type": "sleep_start",
            "stage": "",
            "stage_label": "",
        })
        rows.append({
            "timestamp_jst": session.get("sleep_end", ""),
            "type": "sleep_end",
            "stage": "",
            "stage_label": "",
        })

    # Sleep stage records
    for msg in fit.get_messages():
        if msg.name == "unknown_275":
            d = {f.name: f.value for f in msg.fields}
            garmin_ts = d.get("unknown_253")
            stage = d.get("unknown_0")
            if garmin_ts is not None and stage is not None:
                rows.append({
                    "timestamp_jst": garmin_ts_to_jst(garmin_ts),
                    "type": "sleep_stage",
                    "stage": stage,
                    "stage_label": SLEEP_STAGES.get(stage, f"unknown({stage})"),
                })

    rows.sort(key=lambda r: r["timestamp_jst"])
    write_csv(out, ["timestamp_jst", "type", "stage", "stage_label"], rows)
    return len(rows)


def convert_sleep_disruptions(path: str, out: str):
    fit = FitFile(path)
    rows = []
    for msg in fit.get_messages():
        if msg.name == "unknown_470":
            d = {f.name: f.value for f in msg.fields}
            garmin_ts = d.get("unknown_253")
            if garmin_ts:
                rows.append({
                    "timestamp_jst": garmin_ts_to_jst(garmin_ts),
                    "index": d.get("unknown_254", ""),
                    "value": d.get("unknown_0", ""),
                })
    rows.sort(key=lambda r: r["timestamp_jst"])
    write_csv(out, ["timestamp_jst", "index", "value"], rows)
    return len(rows)


def convert_metrics(path: str, out: str):
    fit = FitFile(path)
    rows = []
    for msg in fit.get_messages("file_id"):
        d = {f.name: f.value for f in msg.fields}
        ts = d.get("time_created")
        rows.append({
            "timestamp_jst": dt_to_jst(ts) if ts else "",
            "manufacturer": d.get("manufacturer", ""),
            "garmin_product": d.get("garmin_product", ""),
            "serial_number": d.get("serial_number", ""),
            "type": d.get("type", ""),
        })
    write_csv(out, ["timestamp_jst", "manufacturer", "garmin_product", "serial_number", "type"], rows)
    return len(rows)


def write_csv(path: str, fieldnames: list, rows: list):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main(folder: str):
    fit_files = sorted(glob.glob(f"{folder}/*.fit"))
    if not fit_files:
        print("No FIT files found.")
        sys.exit(1)

    print(f"Found {len(fit_files)} FIT files\n")

    for path in fit_files:
        name = path.rsplit("/", 1)[-1]
        out = path.replace(".fit", ".csv")
        file_type = name.split("_", 1)[-1].replace(".fit", "")

        try:
            if "WELLNESS" in name:
                count = convert_wellness(path, out)
            elif "HRV_STATUS" in name:
                count = convert_hrv_status(path, out)
            elif "SLEEP_DATA" in name:
                count = convert_sleep_data(path, out)
            elif "SLEEP_DISRUPTIONS" in name:
                count = convert_sleep_disruptions(path, out)
            elif "METRICS" in name:
                count = convert_metrics(path, out)
            else:
                print(f"  SKIP  {name} (unknown type)")
                continue
            print(f"  OK    {name}  →  {name.replace('.fit','.csv')}  ({count} rows)")
        except Exception as e:
            print(f"  ERROR {name}: {e}")


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else "/Users/tetzokabe/Desktop/2026-06-03"
    main(folder)
