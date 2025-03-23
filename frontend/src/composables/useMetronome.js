import { ref } from 'vue'
import metronomeSound from '@/assets/metronome.mp3'

export function useMetronome(timeSignatures, tempos, tempo, barsInfo) {
  const metronomeInterval = ref(null)
  const metronomeAudio = new Audio(metronomeSound)
  metronomeAudio.load()

  const playClickSound = (loud) => {
    metronomeAudio.currentTime = 0
    metronomeAudio.volume = loud ? 1 : 0.1
    metronomeAudio.play()
  }

  const playMetronome = (startBar) => {
    stopMetronome()

    let beatIndex = 0
    let currentOffset = 0
    let timeSignatureIndex = 0
    let tempoIndex = 0
    let lastTime = performance.now()

    const barStartBeat = barsInfo.value.find((b) => b.bar === startBar)?.start_beat ?? 0
    let applicableTS = timeSignatures.value.find(ts => ts.offset <= barStartBeat) || timeSignatures.value[0]
    let applicableTempo = tempos.value.find(t => t.offset <= barStartBeat) || tempos.value[0]

    let beatsPerBar = applicableTS.numerator
    let bpm = applicableTempo.bpm / (tempo.value / 100)
    let secondsPerBeat = 60 / bpm

    const playNextBeat = () => {
      const now = performance.now()
      const elapsed = (now - lastTime) / 1000
      lastTime = now
      currentOffset += elapsed / secondsPerBeat

      // Update time signature and tempo
      while (timeSignatureIndex < timeSignatures.value.length &&
             timeSignatures.value[timeSignatureIndex].offset <= currentOffset) {
        beatsPerBar = timeSignatures.value[timeSignatureIndex].numerator
        timeSignatureIndex++
      }

      while (tempoIndex < tempos.value.length &&
             tempos.value[tempoIndex].offset <= currentOffset) {
        bpm = tempos.value[tempoIndex].bpm / (tempo.value / 100)
        secondsPerBeat = 60 / bpm
        tempoIndex++
      }

      const isStrongBeat = beatIndex % beatsPerBar === 0
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
