from flask import Flask, jsonify, request
from flask_cors import CORS
import pretty_midi
import sounddevice as sd
import numpy as np
import librosa
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for Vue.js frontend

MIDI_FILE = "song-Baritone.mid"  # Ensure correct MIDI file

# ✅ Extract MIDI Notes with Start Time, End Time, and Pitch
def extract_midi_notes():
    """Extracts start time, end time, and pitch from MIDI file, ensuring correct timing."""
    try:
        if not os.path.exists(MIDI_FILE):
            raise FileNotFoundError(f"MIDI file {MIDI_FILE} not found.")

        midi_data = pretty_midi.PrettyMIDI(MIDI_FILE)
        baritone = midi_data.instruments[0]  # Assume first track is baritone

        # Extract start time, end time, and pitch
        notes = [(note.start, note.end, note.pitch) for note in baritone.notes]

        if not notes:
            return np.array([])

        # Convert to NumPy array for consistency
        midi_array = np.array(notes)

        # Debugging
        print("Extracted MIDI Notes:", midi_array[:10])  # Print first 10 notes

        return midi_array

    except Exception as e:
        print(f"Error extracting MIDI notes: {e}")
        return np.array([])

# ✅ Record Live Singing
def record_audio(duration=5, samplerate=44100):
    try:
        print(f"🎤 Recording audio for {duration} seconds...")
        audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='float32')
        sd.wait()
        return np.squeeze(audio)
    except Exception as e:
        print(f"Error recording audio: {e}")
        return np.array([])

# ✅ Smooth Pitch Data to Reduce Noise
def smooth_pitches(pitches, window_size=5):
    """Applies moving average smoothing to reduce noise in pitch extraction."""
    if len(pitches) < window_size:
        return pitches  # Not enough data to smooth

    smoothed_pitches = np.convolve(pitches, np.ones(window_size)/window_size, mode='valid')
    return np.concatenate(
        [[pitches[0]] * (window_size // 2), smoothed_pitches, [pitches[-1]] * (window_size // 2)]
    )

# ✅ Extract Pitch from Audio using librosa.pyin()
def extract_pitches(audio, samplerate=44100, hop_size=512):
    if audio is None or len(audio) == 0:
        return np.array([])

    # Ensure mono audio
    if len(audio.shape) > 1:
        audio = librosa.to_mono(audio)

    # Extract pitches using pyin (better than piptrack)
    pitches, voiced_flags, _ = librosa.pyin(
        audio, 
        fmin=50,#librosa.note_to_hz('C2'), 
        fmax=1000,#librosa.note_to_hz('C6'), 
        sr=samplerate, 
        hop_length=hop_size
    )
    #pitches = np.nan_to_num(pitches, nan=0.0)
    # Collect only valid pitches
    pitch_list = [(t * hop_size / samplerate, librosa.hz_to_midi(pitch)) for t, pitch in enumerate(pitches) if pitch is not None]

    if not pitch_list:
        return np.array([])

    # Convert to numpy array
    pitch_array = np.array(pitch_list)
    # ✅ Fix: Replace NaN with 0 before further processing
    pitches = np.nan_to_num(pitches, nan=0.0)

    # ✅ Remove zero-pitches (silence)
    pitch_array = [
        (t * hop_size / samplerate, librosa.hz_to_midi(pitch)) 
        for t, pitch in enumerate(pitches) if pitch > 0  # Ignore 0 values
    ]
    # Apply smoothing
    #pitch_array[:, 1] = smooth_pitches(pitch_array[:, 1])
    print(pitch_array)
    return pitch_array

# ✅ Flask Route: Run the MIDI vs Singing Extraction (NO DTW)
@app.route('/run-script', methods=['POST'])
def run_extraction():
    data = request.get_json()  # 🔹 CHANGED: Get JSON data from the request
    duration = int(data.get("duration", 5))  # 🔹 CHANGED: Get user-specified duration, default is 5 seconds

    print(f"🎤 Recording for {duration} seconds...")
    audio = record_audio(duration=duration)
    print("🎼 Extracting MIDI notes...")
    midi_notes = extract_midi_notes()
    print("🎵 Extracting live pitches...")
    live_pitches = extract_pitches(audio, samplerate=44100)

    # ✅ Debugging: Print data lengths
    print(f"📊 MIDI Notes: {len(midi_notes)} points")
    print(f"🎶 Live Pitches: {len(live_pitches)} points")

    if midi_notes.size == 0 or len(live_pitches) == 0:
        return jsonify({"error": "No valid pitch data"}), 400

    return jsonify({
        "midi_notes": midi_notes.tolist(),  # Send MIDI note data
        "live_pitches": live_pitches,  # Send recorded pitch data
    })

# ✅ Start Flask Server
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
