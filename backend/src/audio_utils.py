# Import necessary modules
import sounddevice as sd
import numpy as np
import librosa
import time

# Global variables to control recording
stop_recording = False
recorded_data = []

# Callback function to collect audio data chunks
def callback(indata, a, b, status):
    if not stop_recording:
        recorded_data.append(indata.copy())

# Function to stop the recording
def end():
    global stop_recording
    stop_recording = True
    return "Salvestamine peatatud"

# Function to record audio for a given duration
def record_audio_in_time(duration, samplerate=22050):
    global stop_recording, recorded_data
    recorded_data = []
    stop_recording = False

    # Open an audio input stream
    with sd.InputStream(callback=callback, channels=1, samplerate=samplerate):
        for _ in range(int(duration * 10)):  # Check every 0.1 seconds
            if stop_recording:
                return np.array([])
            time.sleep(0.1)

    # Concatenate recorded audio chunks into a single array
    audio = np.concatenate(recorded_data, axis=0)
    return np.squeeze(audio)

# Function to extract pitches from recorded audio
def extract_pitches_from_recorded_audio(audio, latency_buffer, samplerate=22050, hop_size=512):
    if audio is None or len(audio) == 0:
        return np.array([])

    # If stereo, convert to mono
    if len(audio.shape) > 1:
        audio = librosa.to_mono(audio)

    # Extract fundamental frequency (pitch) using librosa's pyin
    pitches, _, _ = librosa.pyin(
        audio, fmin=21.534, fmax=samplerate/2, sr=samplerate, hop_length=hop_size
    )

    # Replace NaNs with 0
    pitches = np.nan_to_num(pitches, nan=0.0)

    # Create a list of (time, MIDI pitch) pairs
    pitch_list = [
        (t * hop_size / samplerate, librosa.hz_to_midi(pitch))
        for t, pitch in enumerate(pitches) if pitch > 0
    ]

    # Apply latency compensation and filter out negative times
    filtered_pitch_list = [(entry[0]-latency_buffer, round(entry[1],2)) for entry in pitch_list if entry[0] >= latency_buffer]

    return np.array(filtered_pitch_list) if filtered_pitch_list else np.array([])
