import { ref } from 'vue'
import metronomeSound from '@/assets/metronome.mp3'

export function useMetronome(timeSignatureInfo, tempoInfo, speed, measureInfo) {
  const metronomeInterval = ref(null)
  const metronomeAudio = new Audio(metronomeSound)
  metronomeAudio.load()

  const playClickSound = (loud) => {
    metronomeAudio.currentTime = 0
    metronomeAudio.volume = loud ? 1 : 0.1
    metronomeAudio.play()
  }

  const playMetronome = (startMeasure) => {
    stopMetronome()

    let beatIndex = 0
    let currentOffset = 0
    let timeSignatureIndex = 0
    let tempoIndex = 0
    let lastTime = performance.now()

    const measureStartBeat = measureInfo.value.find((m) => m.measure === startMeasure).start_beat
    let applicableTS = timeSignatureInfo.value.find(ts => ts.offset <= measureStartBeat)
    let applicableTempo = tempoInfo.value.find(t => t.offset <= measureStartBeat)

    let beatsPerMeasure = applicableTS.numerator
    let bpm = applicableTempo.bpm / speed.value
    let secondsPerBeat = 60 / bpm

    const playNextBeat = () => {
      const now = performance.now()
      const elapsed = (now - lastTime) / 1000
      lastTime = now
      currentOffset += elapsed / secondsPerBeat

      // Update time signature and speed
      while (timeSignatureIndex < timeSignatureInfo.value.length &&
             timeSignatureInfo.value[timeSignatureIndex].offset <= currentOffset) {
        beatsPerMeasure = timeSignatureInfo.value[timeSignatureIndex].numerator
        timeSignatureIndex++
      }

      while (tempoIndex < tempoInfo.value.length &&
             tempoInfo.value[tempoIndex].offset <= currentOffset) {
        bpm = tempoInfo.value[tempoIndex].bpm / speed.value
        secondsPerBeat = 60 / bpm
        tempoIndex++
      }

      const isStrongBeat = beatIndex % beatsPerMeasure === 0
      playClickSound(isStrongBeat)
      beatIndex++

      const delay = secondsPerBeat * 1000 - (performance.now() - now)
      metronomeInterval.value = setTimeout(playNextBeat, delay)
    }

    playNextBeat()
  }

  const stopMetronome = () => {
    if (metronomeInterval.value) {
      clearTimeout(metronomeInterval.value)
      metronomeInterval.value = null
    }
  }

  return {
    playMetronome,
    stopMetronome,
    playClickSound,
  }
}
