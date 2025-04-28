import numpy as np
from music21 import converter
from music21 import chord

# Function to extract tempo change information from a MusicXML file
def get_tempo_info(musicXml_file):
    try:
        # Parse the MusicXML file
        score = converter.parse(musicXml_file)
        
        # Loop over each part (e.g., Soprano, Alto, etc.)
        for part in score.parts:
            # Flatten the structure to find all MetronomeMark objects
            tempos = part.flatten().getElementsByClass('MetronomeMark')

            tempo_changes = []  # List to store found tempos
            for tempo in tempos:
                # Find beat type or default to quarter note
                beat_note_type = tempo.referent.quarterLength if tempo.referent else 1.0
                # Adjust tempo according to beat note type
                effective_bpm = tempo.number / (1.0 / beat_note_type)
                # Store the offset and calculated bpm
                tempo_changes.append((tempo.offset, effective_bpm))

            # Ensure tempos are sorted by where they occur
            tempo_changes.sort(key=lambda x: x[0])

            # Initialize variables for cumulative calculation
            cumulative_time = 0.0
            last_offset = 0.0
            last_known_tempo = tempo_changes[0][1] if tempo_changes else 120  # Default 120 BPM

            final_tempo_list = []  # Final result list

            # Walk through each tempo change
            for tempo_offset, bpm in tempo_changes:
                # Convert beats to seconds using last known tempo
                seconds_per_beat = 60 / last_known_tempo
                cumulative_time += (tempo_offset - last_offset) * seconds_per_beat
                last_offset = tempo_offset
                last_known_tempo = bpm
                # Save structured information
                final_tempo_list.append({"start": cumulative_time, "bpm": bpm, "offset": tempo_offset})

            # Handle case if no tempo markings were found
            if not final_tempo_list:
                final_tempo_list.append({"start": 0.0, "bpm": 120, "offset": 0.0})

            return final_tempo_list

    except Exception as e:
        # Print any parsing error
        print(f"Viga tempo info eraldamisel: {e}")
        return 120

# Function to extract measure information
def get_measure_info(musicXml_file, part_name):
    try:
        # Parse MusicXML file
        score = converter.parse(musicXml_file)
        
        # Get tempo and time signature changes
        tempo_changes = get_tempo_info(musicXml_file)
        time_signatures = get_time_signature_info(musicXml_file, part_name)

        result = []  # Prepare list to collect measure data

        # Loop over parts
        for part in score.parts:
            if part.partName != part_name:
                continue  # Skip if this is not the selected part

            offset_map = part.measureOffsetMap()  # Get mapping: measure offsets
            sorted_offsets = sorted(offset_map.keys())  # Sort offsets

            # Loop over each measure offset
            for i, offset in enumerate(sorted_offsets):
                measure_num = i + 1  # Measure numbers start from 1
                measure_offset_beat = offset  # Beat offset

                # Convert beat offset to real-time start
                measure_start_time = get_end_time_for_beat(measure_offset_beat, tempo_changes)

                # Calculate the measure duration
                if i + 1 < len(sorted_offsets):
                    next_offset = sorted_offsets[i + 1]
                    duration_beats = next_offset - measure_offset_beat
                else:
                    # Use time signature if this is the last measure
                    latest_ts = [ts for ts in time_signatures if ts['offset'] <= measure_offset_beat]
                    duration_beats = (
                        latest_ts[-1]['numerator'] / (latest_ts[-1]['denominator'] / 4)
                        if latest_ts else 4
                    )

                # Save structured data about measure
                result.append({
                    "measure": measure_num,
                    "start_beat": measure_offset_beat,
                    "start_time": measure_start_time,
                    "duration_beats": duration_beats,
                })

            return result

    except Exception as e:
        # Print parsing error
        print(f"Viga taktide info eraldamisel: {e}")
        return []

# Function to get time signature information
def get_time_signature_info(musicXml_file, part_name):
    try:
        # Parse MusicXML file
        score = converter.parse(musicXml_file)

        time_signatures = []  # List to store time signatures

        tempos = score.flatten().getElementsByClass('MetronomeMark')
        tempo_changes = []  # Store tempo changes

        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength if tempo.referent else 1.0
            effective_bpm = tempo.number / (1.0 / beat_note_type)
            tempo_changes.append((tempo.offset, effective_bpm))

        # Sort tempo changes
        tempo_changes.sort(key=lambda x: x[0])

        # Initialize cumulative time tracking
        last_tempo_index = 0
        cumulative_time = 0.0
        last_offset = 0.0
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120

        # Loop through parts to find the matching part
        for part in score.parts:
            if part.partName == part_name:
                for ts in part.flatten().getElementsByClass('TimeSignature'):
                    ts_offset = ts.offset

                    # Handle tempo changes occurring before time signature
                    while last_tempo_index < len(tempo_changes) and tempo_changes[last_tempo_index][0] <= ts_offset:
                        tempo_offset, bpm = tempo_changes[last_tempo_index]
                        seconds_per_beat = 60 / last_known_tempo
                        cumulative_time += (tempo_offset - last_offset) * seconds_per_beat
                        last_known_tempo = bpm
                        last_offset = tempo_offset
                        last_tempo_index += 1

                    # Add time passed from last offset to current time signature
                    seconds_per_beat = 60 / last_known_tempo
                    cumulative_time += (ts_offset - last_offset) * seconds_per_beat
                    last_offset = ts_offset

                    # Save time signature entry
                    time_signatures.append({
                        "start": cumulative_time,
                        "numerator": ts.numerator,
                        "denominator": ts.denominator,
                        "offset": ts_offset
                    })

                return time_signatures

    except Exception as e:
        print(f"Viga taktimõõtude info eraldamisel: {e}")
        return 4, 4

# Function to calculate beat offset up to a given measure number
def get_end_beat_for_measure(measure_number, time_signatures):
    beats = 0
    last_beat_offset = 0
    last_numerator = time_signatures[0]["numerator"]
    last_denominator = time_signatures[0]["denominator"]
    last_measure_number = 0

    # Loop through each time signature change
    for ts in time_signatures:
        ts_beat_offset = ts["offset"]
        ts_numerator = ts["numerator"]
        ts_denominator = ts["denominator"]

        # Beats per measure based on time signature
        beats_per_measure = (last_numerator * 4) / last_denominator

        # Calculate measures until next time signature
        measures_in_section = (ts_beat_offset - last_beat_offset) / beats_per_measure
        ts_measure_number = last_measure_number + measures_in_section

        if measure_number < ts_measure_number:
            break  # Found the correct time signature zone

        # Update tracking variables
        beats += measures_in_section * beats_per_measure
        last_beat_offset = ts_beat_offset
        last_numerator = ts_numerator
        last_denominator = ts_denominator
        last_measure_number = ts_measure_number

    # Handle remaining beats
    beats_per_measure = (last_numerator * 4) / last_denominator
    remaining_measures = measure_number - last_measure_number
    beats += remaining_measures * beats_per_measure

    return beats

# Function to find time range (start and end) for measure numbers
def find_time_range_for_measures(musicXml_file, start_measure, end_measure, speed_multiplier, part_name):
    try:
        tempo_changes = get_tempo_info(musicXml_file)
        time_signatures = get_time_signature_info(musicXml_file, part_name)

        # Get beat positions
        start_beat = get_end_beat_for_measure(start_measure-1, time_signatures)
        end_beat = get_end_beat_for_measure(end_measure, time_signatures)

        # Convert beat offsets to real time
        start_time = get_end_time_for_beat(start_beat, tempo_changes) if start_beat > 0 else 0
        end_time = get_end_time_for_beat(end_beat, tempo_changes)

        # Adjust for speed multiplier
        start_time /= speed_multiplier
        end_time /= speed_multiplier

        return start_time, end_time

    except Exception as e:
        print(f"Viga taktide ajavahemiku leidmisel: {e}")
        return 0, 0

# Function to calculate time from beat offset
def get_end_time_for_beat(beat_offset, tempo_changes):
    if not tempo_changes:
        return beat_offset * (60 / 120)  # Assume 120 BPM

    elapsed_time = 0
    last_beat = 0
    last_bpm = tempo_changes[0]['bpm']

    # Go through tempo changes
    for change in tempo_changes:
        tempo_beat = change['offset']
        bpm = change['bpm']
        if tempo_beat >= beat_offset:
            break

        seconds_per_beat = 60 / last_bpm
        elapsed_time += (tempo_beat - last_beat) * seconds_per_beat
        last_beat = tempo_beat
        last_bpm = bpm

    # Add remaining beats after last change
    seconds_per_beat = 60 / last_bpm
    elapsed_time += (beat_offset - last_beat) * seconds_per_beat

    return elapsed_time

# Function to extract detailed note data between selected measures
def get_note_info(musicXml_file, start_measure, end_measure, part_name):
    try:
        # Parse the MusicXML file
        score = converter.parse(musicXml_file)
        
        # Find all tempo changes in the whole score
        tempos = score.flatten().getElementsByClass('MetronomeMark')

        tempo_changes = []  # List to store (offset, bpm)
        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength  # Get beat unit
            effective_bpm = tempo.number / (1.0 / beat_note_type)  # Calculate effective BPM
            tempo_changes.append((tempo.offset, effective_bpm))

        # Sort tempo changes by offset (beat position)
        tempo_changes.sort(key=lambda x: x[0])

        # Initialize last known tempo (or default 120 BPM)
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120

        notes = []  # List to collect all extracted notes
        running_time = 0.0  # Real time (seconds) tracker
        last_offset = 0.0  # Last processed beat offset
        last_duration = 0  # Last note duration (seconds)

        # Loop through each part in the score
        for part in score.parts:
            if part.partName != part_name:
                continue  # Skip parts that don't match selected

            measures = part.getElementsByClass('Measure')  # Get all measures
            selected_measures = measures[start_measure-1:end_measure]  # Slice measures range

            # Loop through each selected measure
            for measure in selected_measures:
                measure_start_offset = measure.offset  # Beat offset where measure starts

                # If measure has multiple voices, select the first one
                if len([e for e in measure.voices]) > 0:
                    measure = measure.voices[0]

                # Loop through all notes/chords in the measure
                for element in measure.notes:
                    # If element is a chord, pick the highest note
                    if isinstance(element, chord.Chord):
                        element = element[-1]

                    # Get MIDI pitch (number between 0-127)
                    midi_pitch = element.pitch.midi
                    # Get note name (e.g., C4, D#5) and replace '-' with flat sign
                    note_name = element.nameWithOctave.replace('-', '♭')
                    # Beat offset where note starts (relative to full score)
                    note_offset = measure_start_offset + element.offset
                    # Note duration in beats
                    note_duration = element.quarterLength

                    # Handle any tempo changes before this note starts
                    while tempo_changes and tempo_changes[0][0] <= note_offset:
                        tempo_offset, bpm = tempo_changes.pop(0)
                        seconds_per_beat = 60 / last_known_tempo
                        running_time += (tempo_offset - last_offset) * seconds_per_beat
                        last_offset = tempo_offset
                        last_known_tempo = bpm  # Update to new tempo

                    # Calculate note start time based on elapsed beats
                    seconds_per_beat = 60 / last_known_tempo
                    note_start_time = running_time + (note_offset - last_offset) * seconds_per_beat - last_duration
                    note_end_time = note_start_time + (note_duration * seconds_per_beat)

                    # Save extracted note information
                    notes.append({
                        "start": note_start_time,
                        "end": note_end_time,
                        "pitch": midi_pitch,
                        "duration": note_duration,
                        "offset": note_offset,
                        "name": note_name
                    })

                    # Update tracking variables for next note
                    running_time = note_end_time
                    last_offset = note_offset
                    last_duration = note_end_time - note_start_time

            return notes  # Return all extracted notes

    except Exception as e:
        # Print error if anything fails
        print(f"Viga MusicXML nootide info eraldamisel: {e}")
        return np.array([])  # Return empty array on error

# Function to get part names
def get_parts(musicXml_file):
    score = converter.parse(musicXml_file)
    parts = []
    for part in score.parts:
        parts.append(part.partName)
    return parts
