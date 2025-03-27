import sounddevice as sd
import numpy as np
import librosa
import time

stop_recording = False
recorded_data = []

def callback(indata, status):
    if status:
        print(status)
    if not stop_recording:
        recorded_data.append(indata.copy())
        
def end():
    global stop_recording
    stop_recording = True
    return "Recording stopped"
        
def record_audio_in_time(duration, samplerate=44100):
    global stop_recording, recorded_data
    recorded_data = []
    stop_recording = False
    
    with sd.InputStream(callback=callback, channels=1, samplerate=samplerate):
        print(f"Recording for {duration} seconds... ")
        for _ in range(int(duration * 10)):  # check every 0.1s
            if stop_recording:
                print("Recording stopped early — discarding audio.")
                return np.array([])  # Discard if stopped early
            time.sleep(0.1)
            
    # Combine and return audio if completed
    audio = np.concatenate(recorded_data, axis=0)
    return np.squeeze(audio)

'''def record_audio_in_time(duration, samplerate=44100):
    try:
        print(duration)
        duration += 1 # Add 1 second to account for latency
        audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype="float32")
        sd.wait()
        return np.squeeze(audio)
    except Exception as e:
        print(f"Error recording audio: {e}")
        return np.array([])'''

def extract_pitches_from_recorded_audio(audio, samplerate=44100, hop_size=256):
    if audio is None or len(audio) == 0:
        return np.array([])

    if len(audio.shape) > 1:
        audio = librosa.to_mono(audio)

    pitches, _, _ = librosa.pyin(
        audio, fmin=50, fmax=1000, sr=samplerate, hop_length=hop_size
    )

    pitches = np.nan_to_num(pitches, nan=0.0)
    
    pitch_list = [
        (t * hop_size / samplerate, librosa.hz_to_midi(pitch))
        for t, pitch in enumerate(pitches) if pitch > 0
    ]
    
    filtered_pitch_list = [(entry[0]-1, entry[1]) for entry in pitch_list if entry[0] >= 1.0]
    
    return np.array(filtered_pitch_list) if filtered_pitch_list else np.array([])