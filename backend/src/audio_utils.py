import sounddevice as sd
import numpy as np
import librosa

# ✅ Record Audio
def record_audio(duration=5, samplerate=44100):
    try:
        print(f"🎤 Recording for {duration:.2f} seconds...")
        audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype="float32")
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

    pitches, _, _ = librosa.pyin(
        audio, fmin=50, fmax=1000, sr=samplerate, hop_length=hop_size
    )

    pitches = np.nan_to_num(pitches, nan=0.0)
    pitches = pitches[12:]
    pitch_list = [
        (t * hop_size / samplerate, librosa.hz_to_midi(pitch))
        for t, pitch in enumerate(pitches) if pitch > 0
    ]

    return np.array(pitch_list) if pitch_list else np.array([])