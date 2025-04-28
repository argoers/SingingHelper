// Function to calculate the number of beats that a measure ends with
export const getWhichBeatMeasureEndsWith = (measureNumber, timeSignatureInfo) => {
  let beats = 0 // Total number of beats calculated
  let lastBeatOffset = 0 // Offset (start time) of the last beat
  let lastNumerator = 4 // The numerator of the last time signature (default 4 for 4/4 time)
  let lastMeasureNumber = 0 // Last measure number processed

  // Loop through the time signature information to calculate the beats
  for (const ts of timeSignatureInfo) {
    const tsBeatOffset = ts.offset // Offset (start time) of the current time signature
    const tsNumerator = ts.numerator / (ts.denominator / 4) // Convert time signature to beats per measure (quarter notes)

    // Calculate how many measures are before the current time signature
    const measuresBeforeTS = (tsBeatOffset - lastBeatOffset) / lastNumerator
    const currentMeasureNumber = lastMeasureNumber + measuresBeforeTS // The current measure number based on offsets

    if (measureNumber < currentMeasureNumber) break // Stop if the target measure is reached

    // Add beats to the total based on how many measures were before the current time signature
    beats += (currentMeasureNumber - lastMeasureNumber) * lastNumerator
    lastBeatOffset = tsBeatOffset // Update the last beat offset
    lastMeasureNumber = currentMeasureNumber // Update the last measure number
    lastNumerator = tsNumerator // Update the last time signature's numerator (beats per measure)
  }

  // Add the beats for the final partial measure (the target measure)
  beats += (measureNumber - lastMeasureNumber) * lastNumerator

  return beats // Return the total number of beats at the end of the target measure
}

// Function to get the tempo (BPM) at a specific beat considering the tempo changes
export const getCurrentTempo = (beat, tempoInfo, speed, startMeasure) => {
  const absoluteBeat = beat + startMeasure // Add startMeasure to get the absolute beat number
  let currentTempo = tempoInfo[0].bpm // Default to the first tempo in the list

  // Loop through the tempo information to find the current tempo at the given beat
  for (const t of tempoInfo) {
    if (absoluteBeat >= t.offset) {
      // If the absolute beat is greater than or equal to the tempo offset
      currentTempo = t.bpm // Update the current tempo to match the tempo at the given beat
    } else {
      break // Stop once the tempo change offset is past the given beat
    }
  }

  return currentTempo * speed // Return the adjusted tempo considering the speed factor
}

// Function to calculate the Y position of a MIDI note on a canvas for visualization
export const getYPosition = (midiNote, minNotePitch, canvasHeight, oneToneHeight) => {
  // The formula calculates the Y position based on the MIDI note, the minimum pitch, and the canvas height
  return canvasHeight - ((midiNote - minNotePitch + 2) * oneToneHeight) / 2
}
