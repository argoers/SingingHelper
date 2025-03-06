from flask import Blueprint, jsonify, request
import os
from midi_utils import get_time_signature, extract_midi_notes_in_range, bars_to_time_range, get_tempo
from audio_utils import record_audio, extract_pitches
import numpy as np
import random

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
MIDI_FILE = None  # Stores the latest uploaded MIDI file path
# ✅ Variable to track if recording is in progress
is_recording = False

api_routes = Blueprint("api_routes", __name__)

# ✅ Upload MIDI File
@api_routes.route("/upload-midi", methods=["POST"])
def upload_midi():
    global MIDI_FILE

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)
    MIDI_FILE = file_path

    return jsonify({"message": "MIDI file uploaded successfully!", "filename": file.filename})


# ✅ Compare MIDI Notes & Singing
@api_routes.route("/run-script", methods=["POST"])
def run_comparison():
    global MIDI_FILE
    global is_recording
    is_recording=True
    if not MIDI_FILE:
        return jsonify({"error": "No MIDI file uploaded"}), 400

    try:
        data = request.get_json()
        start_bar = int(data.get("start_bar", 1))
        end_bar = int(data.get("end_bar", 4))

        start_time, end_time = bars_to_time_range(MIDI_FILE, start_bar, end_bar)
        duration = end_time - start_time

        midi_notes = extract_midi_notes_in_range(MIDI_FILE, start_time, end_time)
        audio = record_audio(duration=duration)
        live_pitches = extract_pitches(audio)
        live_pitches = np.array([
                (random.uniform(start_time, end_time), random.randint(50, 80)) 
                for _ in range(100)
            ])

        return jsonify({
            "midi_notes": midi_notes.tolist(),
            "live_pitches": live_pitches.tolist(),
            "start_bar": start_bar,
            "end_bar": end_bar
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_routes.route("/cancel-recording", methods=["POST"])
def cancel_recording():
    global is_recording
    if not is_recording:
        return jsonify({"error": "No recording in progress"}), 400

    is_recording = False
    return jsonify({"message": "Recording canceled"})

@api_routes.get("/get-tempo")
def get_midi_tempo():
    try:
        return {"tempo": get_tempo(MIDI_FILE)}
    
    except Exception as e:
        return {"error": str(e)}
