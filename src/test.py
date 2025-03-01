from flask import Flask, jsonify, request
from flask_cors import CORS
import pretty_midi
import sounddevice as sd
import numpy as np
import librosa
import os
import random

app = Flask(__name__)
CORS(app)

#MIDI_FILE = "song-Baritone.mid"
MIDI_FILE = "Baritone2.mid"

# ✅ Extract Tempo & Time Signature from MIDI
def get_midi_info():
    """Extracts the first tempo and time signature from a MIDI file."""
    try:
        midi_data = pretty_midi.PrettyMIDI(MIDI_FILE)

        # Extract tempo (BPM)
        times, tempos = midi_data.get_tempo_changes()
        bpm = tempos[0] if len(tempos) > 0 else 120  # Default to 120 BPM

        # Extract time signature
        time_signatures = midi_data.time_signature_changes
        ts_numerator, ts_denominator = (4, 4)  # Default 4/4
        if len(time_signatures) > 0:
            ts_numerator = time_signatures[0].numerator
            ts_denominator = time_signatures[0].denominator

        return bpm, ts_numerator, ts_denominator

    except Exception as e:
        print(f"Error extracting MIDI info: {e}")
        return 120, 4, 4  # Default values

# ✅ Convert Bars to Time Range
def bars_to_time_range(start_bar, end_bar):
    bpm, ts_numerator, _ = get_midi_info()
    beats_per_bar = ts_numerator
    seconds_per_beat = 60 / bpm
    bar_duration = beats_per_bar * seconds_per_beat

    start_time = (start_bar - 1) * bar_duration
    end_time = end_bar * bar_duration

    return start_time, end_time  

# ✅ Extract MIDI Notes within Selected Time Range
def extract_midi_notes_in_range(start_time, end_time):
    """Extracts MIDI notes that occur within a given time range."""
    try:
        midi_data = pretty_midi.PrettyMIDI(MIDI_FILE)
        baritone = midi_data.instruments[0]  # Assume first instrument is baritone

        notes = [
            (note.start, note.end, note.pitch) 
            for note in baritone.notes if start_time <= note.start < end_time
        ]

        return np.array(notes) if notes else np.array([])

    except Exception as e:
        print(f"Error extracting MIDI notes: {e}")
        return np.array([])

# ✅ Record Audio for Selected Time Range
def record_audio(duration=5, samplerate=44100):
    try:
        print(f"🎤 Recording for {duration:.2f} seconds...")
        audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='float32')
        sd.wait()
        return np.squeeze(audio)
    except Exception as e:
        print(f"Error recording audio: {e}")
        return np.array([])

# ✅ Extract Singing Pitches
def extract_pitches(audio, samplerate=44100, hop_size=512):
    if audio is None or len(audio) == 0:
        return np.array([])

    if len(audio.shape) > 1:
        audio = librosa.to_mono(audio)

    pitches, voiced_flags, _ = librosa.pyin(
        audio, fmin=50,#librosa.note_to_hz('C2'),
        fmax=1000,#librosa.note_to_hz('C6'),
        sr=samplerate, hop_length=hop_size
    )

    pitches = np.nan_to_num(pitches, nan=0.0)

    pitch_list = [
        (t * hop_size / samplerate, librosa.hz_to_midi(pitch)) 
        for t, pitch in enumerate(pitches) if pitch > 0
    ]

    return np.array(pitch_list) if pitch_list else np.array([])

# ✅ Flask Route: Compare MIDI Notes & Singing in the Same Time Range
@app.route('/run-script', methods=['POST'])
def run_comparison():
    try:
        data = request.get_json()
        start_bar = int(data.get("start_bar", 1))
        end_bar = int(data.get("end_bar", 4))

        start_time, end_time = bars_to_time_range(start_bar, end_bar)
        duration = end_time - start_time

        print(f"📊 Extracting MIDI and recording from {start_time:.2f}s to {end_time:.2f}s ({duration:.2f}s duration)")

        midi_notes = extract_midi_notes_in_range(start_time, end_time)
        audio = record_audio(duration=duration)
        live_pitches = extract_pitches(audio, samplerate=44100)
        live_pitches = np.array([
                (random.uniform(start_time, end_time), random.randint(50, 80)) 
                for _ in range(100)
            ])
        print(midi_notes)

        if midi_notes.size == 0 or live_pitches.size == 0:
            return jsonify({"error": "No valid pitch data"}), 400

        return jsonify({
            "midi_notes": midi_notes.tolist(),
            "live_pitches": live_pitches.tolist(),
            "start_bar": start_bar,
            "end_bar": end_bar
        })

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
