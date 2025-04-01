import { ref } from 'vue'
import {
  recordAudio,
  extractPitchesFromRecordedAudio,
  getMusicXmlStartTimeAndDurationInSeconds, cancel
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
  const isInCountdown = ref(false)
  const isRecording = ref(false)
  const isProcessingAudio = ref(false)
  const isRecordingCancelled = ref(false)
  const countdown = ref(0)
  const showChart = ref(false)
  const showReplay = ref(false)
  const isReplaying = ref(false)

  const loadingRecordingMessage = ref('Laula!')
  const loadingProcessingMessage = ref('Loen sisse salvestuse infot')
  const errorMessage = ref('')

  let requestSession = 0

  const startRecordingProcess = async () => {
    const currentSession = ++requestSession
    showChart.value = false
    showReplay.value = false
    isRecordingCancelled.value = false
    errorMessage.value = ''
    isInCountdown.value = true

    const measureStartBeat = measureInfo.value.find(b => b.measure === startMeasure.value).start_beat
    const applicableTS = timeSignatureInfo.value.slice().reverse().find(ts => ts.offset <= measureStartBeat)
    const applicableTempo = tempoInfo.value.slice().reverse().find(t => t.offset <= measureStartBeat)

    const bpm = applicableTempo.bpm / (4 / applicableTS.denominator)
    const beats = applicableTS.numerator * 2
    const clickInterval = 60 / bpm / speed.value
    const totalCountTime = beats * clickInterval

    countdown.value = beats
    let elapsedTime = 0
    let hasStartedRecording = false


    await buildMetronome(startMeasure.value, endMeasure.value, isMetronomeEnabled.value) 
    await startMetronome();

    while (countdown.value > 0) {
      await new Promise(resolve => setTimeout(resolve, clickInterval * 1000))
      elapsedTime += clickInterval
      const timeRemaining = totalCountTime - elapsedTime
      
      if (!hasStartedRecording && timeRemaining < 1.0) {
        startRecordingAudio(currentSession, timeRemaining)
        hasStartedRecording = true
      }
      countdown.value--
    }
    
    isInCountdown.value = false
    isRecording.value = true
  }

  const startRecordingAudio = async (currentSession, latencyBuffer) => {
    try {
      await recordAudio(startMeasure.value, endMeasure.value, speed.value, selectedPart.value, latencyBuffer)
    } catch (err) {
      setError(err.message)
      return
    }

    if (currentSession !== requestSession || isRecordingCancelled.value) return

    stopMetronome()
    isRecording.value = false
    isProcessingAudio.value = true

    try {
      const data = await extractPitchesFromRecordedAudio(startMeasure.value, endMeasure.value)
      if (currentSession === requestSession && !isRecordingCancelled.value) {
        isProcessingAudio.value = false

        const timeData = await getMusicXmlStartTimeAndDurationInSeconds(
          startMeasure.value, endMeasure.value, speed.value, selectedPart.value
        )
        setDuration(timeData.duration)
        setStartTime(timeData.start_time)

        const numPoints = data.liveNotes.length
        const beatStart = measureInfo.value[startMeasure.value - 1].start_beat
        const beatEnd = measureInfo.value[endMeasure.value - 1].start_beat + measureInfo.value[endMeasure.value - 1].duration_beats
        const beatStep = (beatEnd - beatStart) / numPoints
        const beatAxis = Array.from({ length: numPoints }, (_, i) => beatStart + i * beatStep)

        const getWhichMeasureIsBeatIn = (t) => {
          let measure = startMeasure.value
          for (let i = 1; i < measureInfo.value.length; i++) {
            if (t < measureInfo.value[i].start_beat) break
            measure = measureInfo.value[i].measure
          }
          return measure
        }

        const labels = beatAxis.map((t, i) => {
          const measure = getWhichMeasureIsBeatIn(t)
          const previousMeasure = i > 0 ? getWhichMeasureIsBeatIn(beatAxis[i - 1]) : null
          return measure !== previousMeasure ? `Takt ${measure}` : ''
        })

        const musicXmlNotesMappedToBeats = beatAxis.map((t) => {
          const note = musicXmlNoteInfo.value.find(
            (n) => n.offset <= t && t <= n.offset + n.duration
          )
          return note ? note.pitch : null
        })

        chartData.value.datasets[0].data = musicXmlNotesMappedToBeats
        chartData.value.datasets[1].data = data.liveNotes
        chartData.value.labels = labels
        showChart.value = true
        showReplay.value = true
      }
    } catch (err) {
      setError(err.message)
      isProcessingAudio.value = false
    }
  }

  const cancelRecordingProcess = async () => {
    if (stopMetronome) stopMetronome()
    try {
      await cancel();
    } catch (error) {
      console.error(error)
    }
    isRecordingCancelled.value = true
    isRecording.value = false
    isProcessingAudio.value = false
    setError('Recording canceled!')
  }

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
    stopReplay: () => (isReplaying.value = false),
    startReplay: () => (isReplaying.value = true),
    enableReplay: () => (showReplay.value = !showReplay.value),
  }
}