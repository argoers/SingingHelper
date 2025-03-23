import numpy as np
from music21 import converter
import music21

def get_tempo(midi_file):
    try:
        score = converter.parse(midi_file)
        tempos = score.flatten().getElementsByClass('MetronomeMark')

        # Extract tempo changes (offset in beats, BPM)
        tempo_changes = []
        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength if tempo.referent else 1.0  # Normalize to quarter note duration
            effective_bpm = tempo.number / (1.0 / beat_note_type)  # Convert to BPM in quarter note terms
            tempo_changes.append((tempo.offset, effective_bpm))

        # Sort tempo changes by offset (earliest to latest)
        tempo_changes.sort(key=lambda x: x[0])

        # Track time in seconds while processing tempo changes
        cumulative_time = 0.0
        last_offset = 0.0
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120  # Default tempo if none found

        final_tempo_list = []

        for tempo_offset, bpm in tempo_changes:
            # Convert beats to seconds using the last known tempo
            seconds_per_beat = 60 / last_known_tempo
            cumulative_time += (tempo_offset - last_offset) * seconds_per_beat
            last_offset = tempo_offset  # Update last offset
            last_known_tempo = bpm  # Update the tempo

            # Store the tempo change with real-world time
            final_tempo_list.append({"start": cumulative_time, "bpm": bpm, "offset": tempo_offset})

        return final_tempo_list
        
    
    except Exception as e:
        print(f"Error extracting MIDI tempo: {e}")
        return 120
    
def get_bar_info(midi_file, part_name=''):
    try:
        score = converter.parse(midi_file)
        tempo_changes = get_tempo(midi_file)
        time_signatures = get_time_signature(midi_file)

        result = []

        for part in score.parts:
            if part_name and part.partName != part_name:
                continue

            offset_map = part.measureOffsetMap()  # keys = offsets, values = Measure objects
            sorted_offsets = sorted(offset_map.keys())

            for i, offset in enumerate(sorted_offsets):
                bar_num = i + 1
                bar_offset_beat = offset  # This is the start beat
                bar_start_time = compute_real_time_for_beat(bar_offset_beat, tempo_changes, time_signatures)

                # Estimate duration in beats using next offset
                if i + 1 < len(sorted_offsets):
                    next_offset = sorted_offsets[i + 1]
                    duration_beats = next_offset - bar_offset_beat
                else:
                    # fallback using latest time signature
                    latest_ts = [ts for ts in time_signatures if ts['offset'] <= bar_offset_beat]
                    duration_beats = (
                        latest_ts[-1]['numerator'] / (latest_ts[-1]['denominator'] / 4)
                        if latest_ts else 4
                    )

                result.append({
                    "bar": bar_num,
                    "start_beat": bar_offset_beat,
                    "start_time": bar_start_time,
                    "duration_beats": duration_beats,
                })

        return result

    except Exception as e:
        print(f"Error extracting bar info: {e}")
        return []




def get_time_signature(midi_file, part_name=''):
    try:
        score = converter.parse(midi_file)

        # Check if there are parts
        time_signatures = []
        tempos = score.flatten().getElementsByClass('MetronomeMark')

        # Extract tempo changes (offset in beats, BPM)
        tempo_changes = []
        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength if tempo.referent else 1.0  # Convert to quarter note duration
            effective_bpm = tempo.number / (1.0 / beat_note_type)  # Normalize BPM to quarter note beats
            tempo_changes.append((tempo.offset, effective_bpm))

        # Sort tempo changes by offset (earliest to latest)
        tempo_changes.sort(key=lambda x: x[0])

        # Track last known tempo and cumulative time
        last_tempo_index = 0
        cumulative_time = 0.0
        last_offset = 0.0
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120  # Default tempo if none found

        # Process time signatures and accumulate time correctly
        for part in score.parts:
            if part_name == '' or part.partName == part_name:
                for ts in part.flatten().getElementsByClass('TimeSignature'):
                    ts_offset = ts.offset  # Time signature offset in beats

                    # Adjust cumulative time based on tempo changes between last_offset and ts_offset
                    while last_tempo_index < len(tempo_changes) and tempo_changes[last_tempo_index][0] <= ts_offset:
                        tempo_offset, bpm = tempo_changes[last_tempo_index]
                        seconds_per_beat = 60 / last_known_tempo
                        cumulative_time += (tempo_offset - last_offset) * seconds_per_beat
                        last_known_tempo = bpm  # Update tempo
                        last_offset = tempo_offset
                        last_tempo_index += 1

                    # Compute final time for this time signature
                    seconds_per_beat = 60 / last_known_tempo
                    cumulative_time += (ts_offset - last_offset) * seconds_per_beat
                    last_offset = ts_offset

                    # Store time signature with real-world seconds
                    time_signatures.append({"start": cumulative_time, "numerator": ts.numerator, "denominator": ts.denominator, "offset": ts_offset})
            
                return time_signatures

            
    except Exception as e:
        print(f"Error extracting MIDI time signature: {e}")
        return 4, 4

def bar_to_beat(bar_number, time_signatures):
    """
    Convert a bar number to the total number of beats before it starts,
    using time signature changes with offset in beats.
    """
    beats = 0
    last_beat_offset = 0
    last_numerator = 4  # Default to 4/4
    last_bar_number = 0

    for ts in time_signatures:
        ts_beat_offset = ts["offset"]
        ts_numerator = ts["numerator"]

        # Estimate how many bars occurred before this time signature
        bars_in_section = (ts_beat_offset - last_beat_offset) / last_numerator
        ts_bar_number = last_bar_number + bars_in_section

        if bar_number < ts_bar_number:
            break

        beats += (ts_bar_number - last_bar_number) * last_numerator
        last_beat_offset = ts_beat_offset
        last_numerator = ts_numerator
        last_bar_number = ts_bar_number

    # Remaining bars from last time signature to requested bar
    beats += (bar_number - last_bar_number) * last_numerator
    return beats

def bars_to_time_range(midi_file, start_bar, end_bar, tempo_multiplier):
    try:
        tempo_changes = get_tempo(midi_file)
        time_signatures = get_time_signature(midi_file)
        start_beat = bar_to_beat(start_bar-1, time_signatures)
        end_beat = bar_to_beat(end_bar, time_signatures)
        start_time = compute_real_time_for_beat(start_beat, tempo_changes, time_signatures) if start_beat > 0 else 0
        end_time = compute_real_time_for_beat(end_beat, tempo_changes, time_signatures)
        
        print(end_time-start_time)
        start_time /= tempo_multiplier
        end_time /= tempo_multiplier
        
        return start_time, end_time

    except Exception as e:
        print(f"Error in bars_to_time_range: {e}")
        return 0, 0

def compute_real_time_for_beat(beat_offset, tempo_changes, time_signatures):
    if not tempo_changes:
        return beat_offset * (60 / 120)  # default BPM

    elapsed_time = 0
    last_beat = 0
    last_bpm = tempo_changes[0]['bpm']
    last_denominator = time_signatures[0]['denominator']
    
    for change in tempo_changes:
        tempo_beat = change['offset']
        bpm = change['bpm']
        if tempo_beat >= beat_offset:
            break
        for signature in time_signatures:
            denominator = signature['denominator']
            signature_beat = signature['offset']
            if signature_beat >= tempo_beat:
                break
        
        seconds_per_beat = 60 / last_bpm * (4 / last_denominator)
        elapsed_time += (tempo_beat - last_beat) * seconds_per_beat
        last_beat = tempo_beat
        last_bpm = bpm
        last_denominator = denominator
    
    seconds_per_beat = 60 / last_bpm * (4 / last_denominator)
    
    elapsed_time += (beat_offset - last_beat) * seconds_per_beat
    
    return elapsed_time


def extract_midi_notes_in_range(midi_file, start_bar, end_bar, part_name):
    try:
        score = converter.parse(midi_file)
        #score.show('text')
        tempos = score.flatten().getElementsByClass('MetronomeMark')
        
        # Extract tempo changes (offset in beats, BPM)
        tempo_changes = []
        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength
            effective_bpm = tempo.number / (1.0 / beat_note_type)
            tempo_changes.append((tempo.offset, effective_bpm))

        # Sort tempo changes by offset (earliest to latest)
        tempo_changes.sort(key=lambda x: x[0])
        # Ensure at least one default tempo if none are found
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120

        notes = []
        running_time = 0.0  # Track accumulated time correctly
        last_offset = 0.0   # Last processed beat position
        last_duration = 0

        for part in score.parts:
            if part.partName == part_name:
                measures = part.getElementsByClass('Measure')
                selected_measures = measures[start_bar-1:end_bar]

                for measure in selected_measures:
                    measure_start_offset = measure.offset  # Measure offset in beats

                    for element in measure.notes:
                        note_name = element.nameWithOctave
                        midi_pitch = element.pitch.midi
                        note_offset = measure_start_offset + element.offset  # Note position in beats
                        note_duration = element.quarterLength  # Note duration in beats

                        # Update elapsed time using tempo changes
                        while tempo_changes and tempo_changes[0][0] <= note_offset:
                            tempo_offset, bpm = tempo_changes.pop(0)
                            seconds_per_beat = 60 / last_known_tempo
                            running_time += (tempo_offset - last_offset) * seconds_per_beat
                            last_offset = tempo_offset
                            last_known_tempo = bpm  # Update to new tempo

                        # Convert beats to seconds
                        seconds_per_beat = 60 / last_known_tempo
                        note_start_time = running_time + (note_offset - last_offset) * seconds_per_beat - last_duration
                        note_end_time = note_start_time + (note_duration * seconds_per_beat)

                        # Store the note
                        notes.append({"start": note_start_time, "end": note_end_time, "pitch": midi_pitch, "duration": note_duration, "offset": note_offset})
                        
                        # Update running time for next note
                        running_time = note_end_time
                        last_offset = note_offset
                        last_duration = note_end_time - note_start_time

                return notes

    except Exception as e:
        print(f"Error extracting MIDI notes: {e}")
        return np.array([])
    
def get_parts(midi_file):
    score = converter.parse(midi_file)
    parts = []
    for part in score.parts:
        parts.append(part.partName)
    
    return parts