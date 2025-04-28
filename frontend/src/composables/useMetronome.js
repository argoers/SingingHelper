import { ref } from 'vue'
import clickUrl from '@/assets/metronome.mp3' // Import the click sound for the metronome

export function useMetronome(timeSignatureInfo, tempoInfo, speed, measureInfo) {
  // Create an AudioContext to handle the audio context
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const sourceNode = ref(null) // The source node that will play the sound
  const finalBuffer = ref(null) // Buffer to hold the final metronome audio

  // Function to load the metronome click sound
  const loadSample = async (url) => {
    const response = await fetch(url) // Fetch the audio file
    const arrayBuffer = await response.arrayBuffer() // Convert it to an array buffer
    return await audioCtx.decodeAudioData(arrayBuffer) // Decode it to audio data
  }

  // Function to start the metronome
  const startMetronome = async () => {
    const source = audioCtx.createBufferSource() // Create a new audio source
    source.buffer = finalBuffer.value // Set the buffer to the final audio data
    source.connect(audioCtx.destination) // Connect the source to the output (speakers)
    source.start() // Start playing the metronome sound
    sourceNode.value = source // Store the source node for stopping later
  }

  // Function to build the metronome audio data
  const buildMetronome = async (startMeasure, endMeasure, isMetronomeEnabled) => {
    const clickSample = await loadSample(clickUrl) // Load the metronome click sound

    // Get the start and end beats of the selected measures
    const startBeat = measureInfo.value.find((m) => m.measure === startMeasure).start_beat
    const endMeasureObj = measureInfo.value.find((m) => m.measure === endMeasure)
    const endBeat = endMeasureObj.start_beat + endMeasureObj.duration_beats

    let bufferDuration = 0 // Total duration of the audio buffer
    const beatEvents = [] // Array to store the metronome beat events

    let currentOffset = startBeat // Current beat position
    let tsIndex = 0 // Index for time signature changes
    let tempoIndex = 0 // Index for tempo changes

    let isInCountdown = true // Flag to handle countdown behavior
    while (true) {
      const ts = timeSignatureInfo.value[tsIndex] // Get the current time signature
      const tempo = tempoInfo.value[tempoIndex] // Get the current tempo

      const nextTS = timeSignatureInfo.value[tsIndex + 1] // Next time signature change
      const nextTempo = tempoInfo.value[tempoIndex + 1] // Next tempo change

      const beatsPerMeasure = ts.numerator // Number of beats in the measure
      const beatType = ts.denominator // Type of beat (e.g., quarter, eighth)

      // Calculate beats per minute (BPM) and seconds per beat
      const bpm = (tempo.bpm * speed.value) / (4 / beatType)
      const secondsPerBeat = 60 / bpm

      // Calculate the next time change (either a time signature or tempo change)
      let nextChange = Math.min(nextTS?.offset ?? Infinity, nextTempo?.offset ?? Infinity, endBeat)

      const beatsUntilNextChange = nextChange - currentOffset // Calculate beats until the next change
      if (beatsUntilNextChange <= 0) {
        if (nextTS?.offset <= currentOffset) tsIndex++ // Move to the next time signature
        if (nextTempo?.offset <= currentOffset) tempoIndex++ // Move to the next tempo change
        continue
      }

      let numBeats = beatsUntilNextChange / (4 / beatType) // Number of beats to generate in the current segment

      let j = isInCountdown ? 3 : 1 // Number of times to play the click sound (countdown behavior)
      let k = 0
      if (!isMetronomeEnabled) {
        numBeats = beatsPerMeasure * (4 / beatType) // If metronome is disabled, play a full measure
        j -= 1 // Adjust the number of click events
      }
      while (k < j) {
        // Generate beat events
        for (let i = 0; i < numBeats; i++) {
          const isStrong = i % beatsPerMeasure === 0 // Strong beat on the first beat of the measure
          beatEvents.push({
            time: bufferDuration, // Time of the beat event
            volume: isStrong ? 1 : 0.1, // Louder volume for strong beats
          })
          bufferDuration += secondsPerBeat // Increase the buffer duration by seconds per beat
          if (k == 0) currentOffset += 4 / beatType // Adjust the current offset for the first countdown
        }
        k++
      }
      isInCountdown = false // Countdown is over

      if (nextTS === undefined && nextTempo === undefined) {
        break // End loop when no more time signatures or tempo changes
      }
      if (nextChange == endBeat || !isMetronomeEnabled) {
        break // Stop if we reach the end beat or metronome is disabled
      }
    }

    // Create the final audio buffer
    finalBuffer.value = audioCtx.createBuffer(
      1, // Number of channels (mono)
      bufferDuration * audioCtx.sampleRate, // Duration of the buffer in samples
      audioCtx.sampleRate, // Sample rate (samples per second)
    )

    const output = finalBuffer.value.getChannelData(0) // Get the channel data from the buffer

    // Fill the buffer with click events
    for (const event of beatEvents) {
      const clickData = clickSample.getChannelData(0) // Get the click sound data
      const startSample = Math.floor(event.time * audioCtx.sampleRate) // Convert time to sample position

      // Add the click sound data to the buffer at the appropriate position
      for (let i = 0; i < clickData.length; i++) {
        if (startSample + i < output.length) {
          output[startSample + i] += clickData[i] * event.volume // Apply the volume based on the beat
        }
      }
    }
  }

  // Function to stop the metronome sound
  const stopMetronome = () => {
    if (sourceNode.value) {
      sourceNode.value.stop() // Stop the sound
      sourceNode.value.disconnect() // Disconnect the source
      sourceNode.value = null // Reset the source node
    }
  }

  // Return functions and reactive variables to the caller
  return {
    buildMetronome,
    startMetronome,
    stopMetronome,
  }
}
