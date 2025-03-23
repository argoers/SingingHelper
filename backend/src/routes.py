from flask import Blueprint, jsonify, request
import os
from midi_utils import get_time_signature, extract_midi_notes_in_range, bars_to_time_range, get_tempo, get_bar_info, get_parts
from audio_utils import record_audio, extract_pitches
from utils import shutdown_backend
import threading

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
MIDI_FILE = None 
AUDIO = None
DURATION = None
api_routes = Blueprint("api_routes", __name__)

@api_routes.route("/upload-midi", methods=["POST"])
def upload_midi():
    global MIDI_FILE

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    
    #if file.filename.rsplit(".", 1)[1] != "mid":
     #   return jsonify({"error": "Invalid file type. Please upload a MIDI file."}), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)
    MIDI_FILE = file_path

    return jsonify({"message": "MIDI file uploaded successfully!", "filename": file.filename})

@api_routes.route("/record", methods=["POST"])
def record():
    global AUDIO
    global DURATION
    print("Recording audio...")
    try:
        data = request.get_json()
        start_bar = int(data.get("start_bar", 1))
        end_bar = int(data.get("end_bar", 4))
        tempo_multiplier = int(data.get("tempo", 120)) / 100
        
        start_time, end_time = bars_to_time_range(MIDI_FILE, start_bar, end_bar, tempo_multiplier)
        DURATION = end_time - start_time
        print(DURATION)
        AUDIO = record_audio(duration=DURATION)
        
        return jsonify({"message": "recorded"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_routes.route("/extract")
def extract():
    live_pitches = extract_pitches(AUDIO)
    return jsonify({"live_pitches": live_pitches.tolist(), "duration": DURATION })

@api_routes.get("/get-tempo")
def get_midi_tempo():
    try:
        return {"tempo": get_tempo(MIDI_FILE)}
    
    except Exception as e:
        return {"error": str(e)}
    
@api_routes.route("/get-bar-info", methods=['POST'])
def get_midi_bar_info():
    try:
        data = request.get_json()
        part_name = data.get("part_name")
        return {"bar_info": get_bar_info(MIDI_FILE, part_name)}
    
    except Exception as e:
        return {"error": str(e)}
    
@api_routes.route("/get-time-signature", methods=['POST'])
def get_midi_time_signature():
    try:
        data = request.get_json()
        part_name = data.get("part_name")
        return {"time_signatures": get_time_signature(MIDI_FILE, part_name)}
    
    except Exception as e:
        return {"error": str(e)}
    
@api_routes.get("/quit")
def quit():
    threading.Thread(target=shutdown_backend).start()
    return {"message": "Stopped"}

@api_routes.route("/get-midi-notes", methods=["POST"])
def get_midi_notes():
    try:
        data = request.get_json()
        start_bar = int(data.get("start_bar", 1))
        end_bar = int(data.get("end_bar", 4))
        part_name = data.get("part_name")
        midi_notes = extract_midi_notes_in_range(MIDI_FILE, start_bar, end_bar, part_name)
        
        return jsonify({"midi_notes": midi_notes})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_routes.route("/get-midi-start-time-and-duration-from-measures", methods=["POST"])
def get_midi_start_time_and_duration_from_measures():
    try:
        data = request.get_json()
        start_bar = int(data.get("start_bar", 1))
        end_bar = int(data.get("end_bar", 4))
        tempo_multiplier = int(data.get("tempo", 120)) / 100

        start_time, end_time = bars_to_time_range(MIDI_FILE, start_bar, end_bar, tempo_multiplier)
        
        return jsonify({"duration": end_time-start_time, "start_time": start_time})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_routes.route("/get-parts")
def get_midi_parts():
    try:
        return jsonify({"parts": get_parts(MIDI_FILE)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500