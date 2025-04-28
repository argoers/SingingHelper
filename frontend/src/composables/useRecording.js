import { ref } from 'vue'
import {
  recordAudio,
  extractPitchesFromRecordedAudio,
  getMusicXmlStartTimeAndDurationInSeconds,
  cancel,
} from '@/services/api'

export function useRecording({
  startMeasure,
  endMeasure,
  speed,
  chartData,
  musicXmlNoteInfo,
  measureInfo,
  timeSignatureInfo,
  tempoInfo,
  selectedPart,
  buildMetronome,
  startMetronome,
  stopMetronome,
  isMetronomeEnabled,
  setStartTime,
  setDuration,
  setError,
}) {
  // Reactive states for tracking different recording statuses
  const isInCountdown = ref(false)
  const isRecording = ref(false)
  const isProcessingAudio = ref(false)
  const isRecordingCancelled = ref(false)
  const countdown = ref(0) // Countdown timer for recording
  const showChart = ref(false) // Whether to show the chart
  const showReplay = ref(false) // Whether to show the replay controls
  const isReplaying = ref(false) // Whether the replay is active

  // Messages for loading states
  const loadingRecordingMessage = ref('Laula!')
  const loadingProcessingMessage = ref('Loen sisse salvestuse infot')
  const errorMessage = ref('')

  let requestSession = 0 // Session counter to manage multiple requests

  // Start the countdown and recording process
  const startRecordingProcess = async () => {
    const currentSession = ++requestSession // Increment session count to track this request
    showChart.value = false // Hide chart initially
    showReplay.value = false // Hide replay initially
    isRecordingCancelled.value = false // Reset cancel flag
    errorMessage.value = '' // Reset any error message
    isInCountdown.value = true // Start the countdown

    // Get the start beat and relevant time signature and tempo info for the selected measure
    const measureStartBeat = measureInfo.value.find(
      (b) => b.measure === startMeasure.value,
    ).start_beat
    const applicableTS = timeSignatureInfo.value
      .slice()
      .reverse()
      .find((ts) => ts.offset <= measureStartBeat)
    const applicableTempo = tempoInfo.value
      .slice()
      .reverse()
      .find((t) => t.offset <= measureStartBeat)

    // Calculate beats per minute (bpm) and interval between beats
    const bpm = applicableTempo.bpm / (4 / applicableTS.denominator)
    const beats = applicableTS.numerator * 2 // Two beats for the countdown
    const clickInterval = 60 / bpm / speed.value // Time interval between clicks
    const totalCountTime = beats * clickInterval // Total time for the countdown

    countdown.value = beats // Set countdown to number of beats
    let elapsedTime = 0 // Elapsed time during countdown
    let hasStartedRecording = false // Flag to start recording when countdown ends

    // Build the metronome with the current measures
    await buildMetronome(startMeasure.value, endMeasure.value, isMetronomeEnabled.value)
    await startMetronome() // Start the metronome

    // Countdown loop
    while (countdown.value > 0) {
      if (!isInCountdown.value) {
        countdown.value = 0
        return // Stop countdown if interrupted
      }
      await new Promise((resolve) => setTimeout(resolve, clickInterval * 1000)) // Wait for the next beat

      elapsedTime += clickInterval // Update elapsed time
      const timeRemaining = totalCountTime - elapsedTime // Calculate remaining time for countdown

      if (!isInCountdown.value) {
        countdown.value = 0
        return // Stop countdown if interrupted
      }

      if (!hasStartedRecording && timeRemaining < 1.0) {
        startRecordingAudio(currentSession, timeRemaining) // Start recording when countdown ends
        hasStartedRecording = true
      }

      countdown.value-- // Decrement countdown
    }

    isInCountdown.value = false // End countdown
    isRecording.value = true // Set recording flag to true
  }

  // Function to start the actual audio recording
  const startRecordingAudio = async (currentSession, latencyBuffer) => {
    try {
      await recordAudio(
        startMeasure.value,
        endMeasure.value,
        speed.value,
        selectedPart.value,
        latencyBuffer,
      )
    } catch (err) {
      setError(err.message) // Set error message if something goes wrong
      return
    }

    if (currentSession !== requestSession || isRecordingCancelled.value) return // Abort if session is out of sync or recording was cancelled

    stopMetronome() // Stop the metronome after starting recording
    isRecording.value = false // Stop recording flag
    isProcessingAudio.value = true // Start processing the recorded audio

    try {
      const data = await extractPitchesFromRecordedAudio(startMeasure.value, endMeasure.value) // Extract pitches from the recorded audio
      if (currentSession === requestSession && !isRecordingCancelled.value) {
        isProcessingAudio.value = false // Stop processing

        // Retrieve time data for the start time and duration of the selected measures
        const timeData = await getMusicXmlStartTimeAndDurationInSeconds(
          startMeasure.value,
          endMeasure.value,
          speed.value,
          selectedPart.value,
        )
        setDuration(timeData.duration) // Set the duration of the measures
        setStartTime(timeData.start_time) // Set the start time of the measures

        const numPoints = data.liveNotes.length // Number of points (notes) in the recording
        const beatStart = measureInfo.value[startMeasure.value - 1].start_beat // Start beat of the measure
        const beatEnd =
          measureInfo.value[endMeasure.value - 1].start_beat +
          measureInfo.value[endMeasure.value - 1].duration_beats // End beat of the measure
        const beatStep = (beatEnd - beatStart) / numPoints // Step between each beat

        // Create a beat axis to map live notes to beats
        const beatAxis = Array.from({ length: numPoints }, (_, i) => beatStart + i * beatStep)

        // Function to determine which measure a beat belongs to
        const getWhichMeasureIsBeatIn = (t) => {
          let measure = startMeasure.value
          for (let i = 1; i < measureInfo.value.length; i++) {
            if (t < measureInfo.value[i].start_beat) break
            measure = measureInfo.value[i].measure
          }
          return measure
        }

        // Generate labels for the beats (e.g., "Takt 1", "Takt 2")
        const labels = beatAxis.map((t, i) => {
          const measure = getWhichMeasureIsBeatIn(t)
          const previousMeasure = i > 0 ? getWhichMeasureIsBeatIn(beatAxis[i - 1]) : null
          return measure !== previousMeasure ? `Takt ${measure}` : ''
        })

        // Map MIDI notes to beats
        const musicXmlNotesMappedToBeats = beatAxis.map((t) => {
          const note = musicXmlNoteInfo.value.find(
            (n) => n.offset <= t && t <= n.offset + n.duration,
          )
          return note ? note.pitch : null
        })

        // Update chart data with the mapped notes
        chartData.value.datasets[0].data = musicXmlNotesMappedToBeats
        chartData.value.datasets[1].data = data.liveNotes
        chartData.value.labels = labels
        showChart.value = true // Show the chart
        showReplay.value = true // Enable replay
      }
    } catch (err) {
      setError(err.message) // Set error message if extraction fails
      isProcessingAudio.value = false
    }
  }

  // Function to cancel the recording process
  const cancelRecordingProcess = async () => {
    stopMetronome() // Stop the metronome

    if (isRecording.value) {
      try {
        await cancel() // Cancel the recording
      } catch (error) {
        console.error(error) // Log any errors
      }
    } else {
      isInCountdown.value = false // If not recording, stop the countdown
    }

    isRecordingCancelled.value = true // Set the cancel flag
    isRecording.value = false // Stop recording flag
    isProcessingAudio.value = false // Stop processing flag
    setError('Salvestamine katkestatud!') // Set cancellation message
  }

  // Return all necessary states and functions to the caller
  return {
    isInCountdown,
    isRecording,
    isProcessingAudio,
    isRecordingCancelled,
    countdown,
    showChart,
    showReplay,
    isReplaying,
    loadingRecordingMessage,
    loadingProcessingMessage,
    errorMessage,
    startRecordingProcess,
    cancelRecordingProcess,
    stopReplay: () => (isReplaying.value = false), // Stop replay
    startReplay: () => (isReplaying.value = true), // Start replay
    enableReplay: () => (showReplay.value = !showReplay.value), // Toggle replay visibility
  }
}
