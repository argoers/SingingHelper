// composables/useRecording.js
import { ref } from 'vue'
import {
  recordAudio,
  extractPitchesFromAudio,
  getMidiStartTimeAndDurationFromMeasures,
} from '@/services/api'

export function useRecording({
  startBar,
  endBar,
  tempo,
  chartData,
  midiNotes,
  barsInfo,
  timeSignatures,
  tempos,
  playClickSound,
  playMetronome,
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

  const loadingRecordingMessage = ref('Sing now!')
  const loadingProcessingMessage = ref('Processing audio')
  const errorMessage = ref('')

  let requestSession = 0

  const startRecordingProcess = async () => {
    const currentSession = ++requestSession
    showChart.value = false
    showReplay.value = false
    isRecordingCancelled.value = false
    errorMessage.value = ''
    isInCountdown.value = true

    const barStartBeat = barsInfo.value.find(b => b.bar === startBar.value)?.start_beat ?? 0
    const applicableTS = [...timeSignatures.value].reverse().find(ts => ts.offset <= barStartBeat)
    const applicableTempo = [...tempos.value].reverse().find(t => t.offset <= barStartBeat)

    const bpm = applicableTempo.bpm
    const beats = applicableTS.numerator
    const speedMultiplier = tempo.value / 100
    const clickInterval = 60 / bpm / speedMultiplier
    const totalCountTime = beats * clickInterval

    countdown.value = beats
    let elapsedTime = 0
    let hasStartedRecording = false

    while (true) {
      const timeRemaining = totalCountTime - elapsedTime
      if (!hasStartedRecording && timeRemaining <= 1.0) {
        startRecordingAudio(currentSession)
        hasStartedRecording = true
      }
      if (timeRemaining <= 0) break

      if (playClickSound && isMetronomeEnabled.value) playClickSound()
      await new Promise(resolve => setTimeout(resolve, clickInterval * 1000))
      elapsedTime += clickInterval
      countdown.value--
    }

    if (playMetronome && isMetronomeEnabled.value) playMetronome()
    isInCountdown.value = false
    isRecording.value = true
  }

  const startRecordingAudio = async (currentSession) => {
    try {
      await recordAudio(startBar.value, endBar.value, tempo.value)
    } catch (err) {
      setError(err.message)
      return
    }

    if (currentSession !== requestSession || isRecordingCancelled.value) return

    isRecording.value = false
    isProcessingAudio.value = true

    try {
      const data = await extractPitchesFromAudio(startBar.value, endBar.value)
      if (currentSession === requestSession && !isRecordingCancelled.value) {
        chartData.value.datasets[1].data = data.liveNotes
        isProcessingAudio.value = false

        const timeData = await getMidiStartTimeAndDurationFromMeasures(
          startBar.value, endBar.value, tempo.value
        )
        setDuration(timeData.duration)
        setStartTime(timeData.start_time)

        const numPoints = data.liveNotes.length
        const beatStart = barsInfo.value[startBar.value - 1].start_beat
        const beatEnd = barsInfo.value[endBar.value - 1].start_beat + barsInfo.value[endBar.value - 1].duration_beats
        const beatStep = (beatEnd - beatStart) / numPoints
        const beatAxis = Array.from({ length: numPoints }, (_, i) => beatStart + i * beatStep)

        const beatToBar = (t) => {
          let bar = startBar.value
          for (let i = 1; i < barsInfo.value.length; i++) {
            if (t < barsInfo.value[i].start_beat) break
            bar = barsInfo.value[i].bar
          }
          return bar
        }

        const labels = beatAxis.map((t, i) => {
          const bar = beatToBar(t)
          const prevBar = i > 0 ? beatToBar(beatAxis[i - 1]) : null
          return bar !== prevBar ? `Bar ${bar}` : ''
        })

        const midiMapped = beatAxis.map((t) => {
          const note = midiNotes.value.find(
            (n) => n.offset <= t && t <= n.offset + n.duration
          )
          return note ? note.pitch : null
        })

        chartData.value.datasets[0].data = midiMapped
        chartData.value.labels = labels
        showChart.value = true
        showReplay.value = true
      }
    } catch (err) {
      setError(err.message)
      isProcessingAudio.value = false
    }
  }

  const cancelRecordingProcess = () => {
    if (stopMetronome) stopMetronome()
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

/*
            function timeToBar(t) {
              let currentBar = barsInfo.value[startBar.value - 1].bar
              for (let i = 1; i < barsInfo.value.length; i++) {
                //console.log(t, barsInfo.value[i].start_time / (tempo.value / 100))
                if (t < barsInfo.value[i].start_time / (tempo.value / 100)) break
                currentBar = barsInfo.value[i].bar
              }
              return currentBar
            }
            const timeStep = data.duration / numPoints
            const timeAxis = Array.from(
              { length: numPoints },
              (_, i) => startTime.value + i * timeStep,
            )

            const labels = timeAxis.map((t, i) => {
              const currentBar = timeToBar(t)
              const prevBar = i > 0 ? timeToBar(timeAxis[i - 1]) : null
              return currentBar !== prevBar ? `Bar ${currentBar}` : ''
            })

            const midiMapped = timeAxis.map((t) => {
              const activeNote = midiNotes.value.find(
                (note) =>
                  note.start / (tempo.value / 100) <= t && t <= note.end / (tempo.value / 100),
              )
              return activeNote ? activeNote.pitch : null
            })
            */