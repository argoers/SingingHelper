import sounddevice as sd
import numpy as np
import librosa

def record_audio_in_time(duration=5, samplerate=44100, mic='default'):
    try:
        duration += 1 # Add 1 second to account for latency
        audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype="float32")
        sd.wait()
        return np.squeeze(audio)
    except Exception as e:
        print(f"Error recording audio: {e}")
        return np.array([])

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