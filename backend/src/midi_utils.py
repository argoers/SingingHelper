import pretty_midi
import numpy as np

# ✅ Extract Tempo & Time Signature
def get_midi_info(midi_file):
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_file)
        times, tempos = midi_data.get_tempo_changes()
        bpm = tempos[0] if len(tempos) > 0 else 120  

        time_signatures = midi_data.time_signature_changes
        ts_numerator = time_signatures[0].numerator if time_signatures else 4
        ts_denominator = time_signatures[0].denominator if time_signatures else 4

        return bpm, ts_numerator, ts_denominator

    except Exception as e:
        print(f"Error extracting MIDI info: {e}")
        return 120, 4, 4


# ✅ Convert Bars to Time Range
def bars_to_time_range(midi_file, start_bar, end_bar):
    bpm, ts_numerator, _ = get_midi_info(midi_file)
    beats_per_bar = ts_numerator
    seconds_per_beat = 60 / bpm
    bar_duration = beats_per_bar * seconds_per_beat

    start_time = (start_bar - 1) * bar_duration
    end_time = end_bar * bar_duration

    return start_time, end_time  


# ✅ Extract MIDI Notes within Selected Time Range
def extract_midi_notes_in_range(midi_file, start_time, end_time):
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_file)
        baritone = midi_data.instruments[0]

        notes = [
            (note.start, note.end, note.pitch)
            for note in baritone.notes if start_time <= note.start < end_time
        ]

        return np.array(notes) if notes else np.array([])

    except Exception as e:
        print(f"Error extracting MIDI notes: {e}")
        return np.array([])