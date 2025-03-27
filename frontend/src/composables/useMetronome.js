import { ref } from 'vue'
import clickUrl from '@/assets/metronome.mp3'

export function useMetronome(timeSignatureInfo, tempoInfo, speed, measureInfo) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const sourceNode = ref(null)
  const finalBuffer = ref(null)

  const loadSample = async (url) => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return await audioCtx.decodeAudioData(arrayBuffer)
  }

  const startMetronome = async () => {
    const source = audioCtx.createBufferSource()
    source.buffer = finalBuffer.value
    source.connect(audioCtx.destination)
    source.start()
    sourceNode.value = source
  }

  const buildMetronome = async (startMeasure, endMeasure, isMetronomeEnabled) => {
    const clickSample = await loadSample(clickUrl)

    const startBeat = measureInfo.value.find((m) => m.measure === startMeasure).start_beat
    const endMeasureObj = measureInfo.value.find((m) => m.measure === endMeasure)
    const endBeat = endMeasureObj.start_beat + endMeasureObj.duration_beats

    let bufferDuration = 0
    const beatEvents = []

    let currentOffset = startBeat
    let tsIndex = 0
    let tempoIndex = 0

    let i = 0
    let isInCountdown = true
    while (true) {
      const ts = timeSignatureInfo.value[tsIndex]
      const tempo = tempoInfo.value[tempoIndex]

      const nextTS = timeSignatureInfo.value[tsIndex + 1]
      const nextTempo = tempoInfo.value[tempoIndex + 1]

      const beatsPerMeasure = ts.numerator
      const beatType = ts.denominator

      const bpm = tempo.bpm * speed.value / (4 / beatType)
      const secondsPerBeat = 60 / bpm

      let nextChange = Math.min(nextTS?.offset ?? Infinity, nextTempo?.offset ?? Infinity, endBeat)
      if (nextTS === undefined && nextTempo === undefined) break
      
      const beatsUntilNextChange = nextChange - currentOffset
      if (beatsUntilNextChange <= 0) {
        if (nextTS?.offset <= currentOffset) tsIndex++
        if (nextTempo?.offset <= currentOffset) tempoIndex++
        continue
      }

      const numBeats = beatsUntilNextChange / (4 / beatType)

      let j = isInCountdown ? 3 : 1
      let k = 0
      if (!isMetronomeEnabled) j -= 1
      while (k < j) {
        for (let i = 0; i < numBeats; i++) {
          const isStrong = i % beatsPerMeasure === 0
          beatEvents.push({
            time: bufferDuration,
            volume: isStrong ? 1 : 0.1,
          })
          bufferDuration += secondsPerBeat
          if (k == 0) currentOffset += 4 / beatType
        }
        k++
      }
      isInCountdown = false
      
      if (nextChange == endBeat || !isMetronomeEnabled) break
    }
    finalBuffer.value = audioCtx.createBuffer(
      1,
      bufferDuration * audioCtx.sampleRate,
      audioCtx.sampleRate,
    )
    const output = finalBuffer.value.getChannelData(0)

    for (const event of beatEvents) {
      const clickData = clickSample.getChannelData(0)
      const startSample = Math.floor(event.time * audioCtx.sampleRate)

      for (let i = 0; i < clickData.length; i++) {
        if (startSample + i < output.length) {
          output[startSample + i] += clickData[i] * event.volume
        }
      }
    }
  }

  const stopMetronome = () => {
    if (sourceNode.value) {
      sourceNode.value.stop()
      sourceNode.value.disconnect()
      sourceNode.value = null
    }
  }

  return {
    buildMetronome,
    startMetronome,
    stopMetronome,
  }
}
