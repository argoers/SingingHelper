import numpy as np
from music21 import converter
from music21 import chord

def get_tempo_info(musicXml_file):
    try:
        score = converter.parse(musicXml_file)
        for part in score.parts:
            tempos = part.flatten().getElementsByClass('MetronomeMark')

            tempo_changes = []
            for tempo in tempos:
                beat_note_type = tempo.referent.quarterLength if tempo.referent else 1.0 
                effective_bpm = tempo.number / (1.0 / beat_note_type) 
                tempo_changes.append((tempo.offset, effective_bpm))

            tempo_changes.sort(key=lambda x: x[0])
            
            cumulative_time = 0.0
            last_offset = 0.0
            last_known_tempo = tempo_changes[0][1] if tempo_changes else 120 

            final_tempo_list = []

            for tempo_offset, bpm in tempo_changes:
                seconds_per_beat = 60 / last_known_tempo
                cumulative_time += (tempo_offset - last_offset) * seconds_per_beat
                last_offset = tempo_offset  
                last_known_tempo = bpm  

                final_tempo_list.append({"start": cumulative_time, "bpm": bpm, "offset": tempo_offset})

            if not final_tempo_list:
                final_tempo_list.append({"start": 0.0, "bpm": 120, "offset": 0.0})

            return final_tempo_list
        
    
    except Exception as e:
        print(f"Viga tempo info eraldamisel: {e}")
        return 120
    
def get_measure_info(musicXml_file, part_name):
    try:
        score = converter.parse(musicXml_file)
        tempo_changes = get_tempo_info(musicXml_file)
        time_signatures = get_time_signature_info(musicXml_file, part_name)

        result = []

        for part in score.parts:
            if part.partName != part_name:
                continue

            offset_map = part.measureOffsetMap()  
            sorted_offsets = sorted(offset_map.keys())

            for i, offset in enumerate(sorted_offsets):
                measure_num = i + 1
                measure_offset_beat = offset  
                measure_start_time = get_end_time_for_beat(measure_offset_beat, tempo_changes)

                if i + 1 < len(sorted_offsets):
                    next_offset = sorted_offsets[i + 1]
                    duration_beats = next_offset - measure_offset_beat
                else:
                    latest_ts = [ts for ts in time_signatures if ts['offset'] <= measure_offset_beat]
                    duration_beats = (
                        latest_ts[-1]['numerator'] / (latest_ts[-1]['denominator'] / 4)
                        if latest_ts else 4
                    )

                result.append({
                    "measure": measure_num,
                    "start_beat": measure_offset_beat,
                    "start_time": measure_start_time,
                    "duration_beats": duration_beats,
                })

            return result

    except Exception as e:
        print(f"Viga taktide info eraldamisel: {e}")
        return []

def get_time_signature_info(musicXml_file, part_name):
    try:
        score = converter.parse(musicXml_file)

        time_signatures = []
        tempos = score.flatten().getElementsByClass('MetronomeMark')

        tempo_changes = []
        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength if tempo.referent else 1.0  
            effective_bpm = tempo.number / (1.0 / beat_note_type)  
            tempo_changes.append((tempo.offset, effective_bpm))

        tempo_changes.sort(key=lambda x: x[0])

        last_tempo_index = 0
        cumulative_time = 0.0
        last_offset = 0.0
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120

        for part in score.parts:
            if part.partName == part_name:
                for ts in part.flatten().getElementsByClass('TimeSignature'):
                    ts_offset = ts.offset 

                    while last_tempo_index < len(tempo_changes) and tempo_changes[last_tempo_index][0] <= ts_offset:
                        tempo_offset, bpm = tempo_changes[last_tempo_index]
                        seconds_per_beat = 60 / last_known_tempo
                        cumulative_time += (tempo_offset - last_offset) * seconds_per_beat
                        last_known_tempo = bpm 
                        last_offset = tempo_offset
                        last_tempo_index += 1

                    seconds_per_beat = 60 / last_known_tempo
                    cumulative_time += (ts_offset - last_offset) * seconds_per_beat
                    last_offset = ts_offset

                    time_signatures.append({"start": cumulative_time, "numerator": ts.numerator, "denominator": ts.denominator, "offset": ts_offset})
            
                return time_signatures

            
    except Exception as e:
        print(f"Viga taktimõõtude info eraldamisel: {e}")
        return 4, 4

def get_end_beat_for_measure(measure_number, time_signatures):
    beats = 0
    last_beat_offset = 0
    last_numerator = time_signatures[0]["numerator"]
    last_denominator = time_signatures[0]["denominator"]
    last_measure_number = 0

    for ts in time_signatures:
        ts_beat_offset = ts["offset"]
        ts_numerator = ts["numerator"]
        ts_denominator = ts["denominator"]

        beats_per_measure = (last_numerator * 4) / last_denominator

        measures_in_section = (ts_beat_offset - last_beat_offset) / beats_per_measure
        ts_measure_number = last_measure_number + measures_in_section

        if measure_number < ts_measure_number:
            break

        beats += measures_in_section * beats_per_measure
        last_beat_offset = ts_beat_offset
        last_numerator = ts_numerator
        last_denominator = ts_denominator
        last_measure_number = ts_measure_number

    beats_per_measure = (last_numerator * 4) / last_denominator
    remaining_measures = measure_number - last_measure_number
    beats += remaining_measures * beats_per_measure

    return beats


def find_time_range_for_measures(musicXml_file, start_measure, end_measure, speed_multiplier, part_name):
    try:
        tempo_changes = get_tempo_info(musicXml_file)
        time_signatures = get_time_signature_info(musicXml_file, part_name)
        start_beat = get_end_beat_for_measure(start_measure-1, time_signatures)
        end_beat = get_end_beat_for_measure(end_measure, time_signatures)
        start_time = get_end_time_for_beat(start_beat, tempo_changes) if start_beat > 0 else 0
        end_time = get_end_time_for_beat(end_beat, tempo_changes)
        
        start_time /= speed_multiplier
        end_time /= speed_multiplier
    
        return start_time, end_time

    except Exception as e:
        print(f"Viga taktide ajavahemiku leidmisel: {e}")
        return 0, 0

def get_end_time_for_beat(beat_offset, tempo_changes):
    if not tempo_changes:
        return beat_offset * (60 / 120)

    elapsed_time = 0
    last_beat = 0
    last_bpm = tempo_changes[0]['bpm']
    
    for change in tempo_changes:
        tempo_beat = change['offset']
        bpm = change['bpm']
        if tempo_beat >= beat_offset:
            break
        
        seconds_per_beat = 60 / last_bpm
        elapsed_time += (tempo_beat - last_beat) * seconds_per_beat
        last_beat = tempo_beat
        last_bpm = bpm
    
    seconds_per_beat = 60 / last_bpm
    
    elapsed_time += (beat_offset - last_beat) * seconds_per_beat
    
    return elapsed_time

def get_note_info(musicXml_file, start_measure, end_measure, part_name):
    try:
        score = converter.parse(musicXml_file)
        tempos = score.flatten().getElementsByClass('MetronomeMark')
        
        tempo_changes = []
        for tempo in tempos:
            beat_note_type = tempo.referent.quarterLength
            effective_bpm = tempo.number / (1.0 / beat_note_type)
            tempo_changes.append((tempo.offset, effective_bpm))

        tempo_changes.sort(key=lambda x: x[0])
        last_known_tempo = tempo_changes[0][1] if tempo_changes else 120

        notes = []
        running_time = 0.0  
        last_offset = 0.0   
        last_duration = 0

        for part in score.parts:
            if part.partName != part_name:
                continue
            measures = part.getElementsByClass('Measure')
            selected_measures = measures[start_measure-1:end_measure]

            for measure in selected_measures:
                measure_start_offset = measure.offset  
                if len([e for e in measure.voices]) > 0:
                    measure = measure.voices[0]
                for element in measure.notes:
                    if isinstance(element, chord.Chord):
                        element = element[-1] 

                    midi_pitch = element.pitch.midi
                    note_name = element.nameWithOctave.replace('-','♭')
                    note_offset = measure_start_offset + element.offset 
                    note_duration = element.quarterLength  
                    
                    while tempo_changes and tempo_changes[0][0] <= note_offset:
                        tempo_offset, bpm = tempo_changes.pop(0)
                        seconds_per_beat = 60 / last_known_tempo
                        running_time += (tempo_offset - last_offset) * seconds_per_beat
                        last_offset = tempo_offset
                        last_known_tempo = bpm  

                    seconds_per_beat = 60 / last_known_tempo
                    note_start_time = running_time + (note_offset - last_offset) * seconds_per_beat - last_duration
                    note_end_time = note_start_time + (note_duration * seconds_per_beat)

                    notes.append({"start": note_start_time, "end": note_end_time, "pitch": midi_pitch, "duration": note_duration, "offset": note_offset, "name": note_name})
                    
                    running_time = note_end_time
                    last_offset = note_offset
                    last_duration = note_end_time - note_start_time

            return notes

    except Exception as e:
        print(f"Viga MusicXML nootide info eraldamisel: {e}")
        return np.array([])
    
def get_parts(musicXml_file):
    score = converter.parse(musicXml_file)
    parts = []
    for part in score.parts:
        parts.append(part.partName)
    
    return parts