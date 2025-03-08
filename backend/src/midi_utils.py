import pretty_midi
import numpy as np
from math import ceil

def get_tempo(midi_file):
    try:
        pm = pretty_midi.PrettyMIDI(midi_file)
        tempo_changes = pm.get_tempo_changes()
        if len(tempo_changes[1]) > 0:
            tempo = tempo_changes[1][0]  # Get first detected tempo

        return tempo
    
    except Exception as e:
        print(f"Error extracting MIDI tempo: {e}")
        return 120
    
def get_bar_total(midi_file):
    try:
        pm = pretty_midi.PrettyMIDI(midi_file)
        beats, denominator = get_time_signature(midi_file)
        total_beats = len(pm.get_beats())
        beats_per_bar = beats / (denominator / 4)
        total_bars = total_beats / beats_per_bar
        
        return ceil(total_bars)
    
    except Exception as e:
        print(f"Error extracting MIDI bars: {e}")
        return 4

# ✅ Extract Tempo & Time Signature
def get_time_signature(midi_file):
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_file)
        time_signatures = midi_data.time_signature_changes
        ts_numerator = time_signatures[0].numerator if time_signatures else 4
        ts_denominator = time_signatures[0].denominator if time_signatures else 4

        return ts_numerator, ts_denominator

    except Exception as e:
        print(f"Error extracting MIDI time signature: {e}")
        return 120, 4, 4


# ✅ Convert Bars to Time Range
def bars_to_time_range(midi_file, start_bar, end_bar):
    ts_numerator, _ = get_time_signature(midi_file)
    bpm = get_tempo(midi_file)
    beats_per_bar = ts_numerator
    seconds_per_beat = 60 / bpm
    bar_duration = beats_per_bar * seconds_per_beat

    start_time = (start_bar - 1) * bar_duration
    end_time = end_bar * bar_duration

    return start_time, end_time, bpm  


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