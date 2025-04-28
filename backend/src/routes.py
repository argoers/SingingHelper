from flask import Blueprint, jsonify, request
import os
from musicXml_utils import get_time_signature_info, get_note_info, find_time_range_for_measures, get_tempo_info, get_measure_info, get_parts
from audio_utils import record_audio_in_time, extract_pitches_from_recorded_audio, end
from utils import shutdown_backend
import threading

# Define the upload directory relative to this file
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")

# Create upload folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Global variables to hold uploaded MusicXML file and recording states
MUSICXML_FILE = None 
RECORDED_AUDIO = None
DURATION = None
LATENCY_BUFFER = None

# Initialize Flask Blueprint for the API routes
api_routes = Blueprint("api_routes", __name__)

@api_routes.route("/upload-musicXml", methods=["POST"])
def upload_musicXml():
    # Handle uploading of MusicXML file
    global MUSICXML_FILE

    if "file" not in request.files:
        return jsonify({"error": "Faili ei laetud üles."}), 400  # No file part

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Faili ei valitud."}), 400  # No file selected

    # Check file extension
    if file.filename.rsplit(".", 1)[1] not in ["mxl", "musicxml"]:
        return jsonify({"error": "Vale failitüüp! Palun vali MusicXML fail (.mxl, .musicxml)."}), 400

    # Save the uploaded file
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)
    MUSICXML_FILE = file_path  # Update global reference

    return jsonify({"message": "MusicXML fail üles laetud edukalt!", "filename": file.filename})

@api_routes.route("/record-audio", methods=["POST"])
def record_audio():
    # Start recording audio for selected measures
    global RECORDED_AUDIO
    global DURATION
    global LATENCY_BUFFER
    try:
        data = request.get_json()
        start_measure = data.get("start_measure")
        end_measure = data.get("end_measure")
        speed_multiplier = data.get("speed")
        part_name = data.get("part_name")
        LATENCY_BUFFER = data.get("latency_buffer")
        
        # Find start and end times for measures
        start_time, end_time = find_time_range_for_measures(MUSICXML_FILE, start_measure, end_measure, speed_multiplier, part_name)
        DURATION = end_time - start_time

        # Record audio with duration plus latency buffer
        RECORDED_AUDIO = record_audio_in_time(DURATION + LATENCY_BUFFER)
        
        return jsonify({"message": "Salvestamine lõpetatud", "f": RECORDED_AUDIO.tolist()})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_routes.get("/end")
def end_rec():
    # End ongoing recording early
    try:
        end()
        return jsonify({"message": "Salvestamine katkestatud"})
    except Exception as e:   
        return jsonify({"error": str(e)}), 500

@api_routes.route("/extract-pitches-from-recorded-audio")
def extract_pitches():
    # Extract pitch information from the recorded audio
    live_pitches = extract_pitches_from_recorded_audio(RECORDED_AUDIO, LATENCY_BUFFER)
    return jsonify({"live_pitches": live_pitches.tolist(), "duration": DURATION})

@api_routes.get("/get-musicXml-tempo-info")
def get_musicXml_tempo_info():
    # Get tempo changes from uploaded MusicXML file
    try:
        return {"tempo_info": get_tempo_info(MUSICXML_FILE)}
    except Exception as e:
        return {"error": str(e)}

@api_routes.route("/get-musicXml-measure-info", methods=["POST"])
def get_musicXml_measure_info():
    # Get measure details for a specific part
    try:
        data = request.get_json()
        part_name = data.get("part_name")
        return {"measure_info": get_measure_info(MUSICXML_FILE, part_name)}
    except Exception as e:
        return {"error": str(e)}

@api_routes.route("/get-musicXml-time-signature-info", methods=["POST"])
def get_musicXml_time_signature_info():
    # Get time signature changes for a specific part
    try:
        data = request.get_json()
        part_name = data.get("part_name")
        return {"time_signature_info": get_time_signature_info(MUSICXML_FILE, part_name)}
    except Exception as e:
        return {"error": str(e)}

@api_routes.get("/quit-application")
def quit_application():
    # Shut down backend server
    threading.Thread(target=shutdown_backend).start()
    return {"message": "Rakendus suletakse."}

@api_routes.route("/get-musicXml-note-info", methods=["POST"])
def get_musicXml_note_info():
    # Get note information for a range of measures in a part
    try:
        data = request.get_json()
        start_measure = data.get("start_measure")
        end_measure = data.get("end_measure")
        part_name = data.get("part_name")
        note_info = get_note_info(MUSICXML_FILE, start_measure, end_measure, part_name)

        return jsonify({"note_info": note_info})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_routes.route("/get-musicXml-start-time-and-duration-in-seconds", methods=["POST"])
def get_musicXml_start_time_and_duration_in_seconds():
    # Calculate start time and total duration in seconds for a measure range
    try:
        data = request.get_json()
        start_measure = data.get("start_measure")
        end_measure = data.get("end_measure")
        speed_multiplier = data.get("speed")
        part_name = data.get("part_name")

        start_time, end_time = find_time_range_for_measures(MUSICXML_FILE, start_measure, end_measure, speed_multiplier, part_name)

        return jsonify({"duration": end_time - start_time, "start_time": start_time})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_routes.route("/get-musicXml-part-names")
def get_musicXml_part_names():
    # Get available part names from the MusicXML file
    try:
        return jsonify({"parts": get_parts(MUSICXML_FILE)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
