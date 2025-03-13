import sounddevice as sd
import numpy as np
import librosa

def find_microphone(mic):
    """Lists available input devices (microphones)."""
    devices = sd.query_devices()
    print("\nAvailable Input Devices:\n")
    for i, device in enumerate(devices):
        if device['name'] == mic.split(')',1)[0]+')' and device['max_input_channels'] > 0:  # Only show input devices
            return i

def record_audio(duration=5, samplerate=44100, mic='default'):
    try:
        print(f"🎤 Recording for {duration:.2f} seconds...")
        if mic != 'default':
            mic_id = find_microphone(mic)
            #sd.default.device = mic_id
        print(mic_id)
        audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype="float32", device=mic_id)
        sd.wait()
        return np.squeeze(audio)
    except Exception as e:
        print(f"Error recording audio: {e}")
        return np.array([])

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