export const getWhichBeatMeasureEndsWith = (measureNumber, timeSignatureInfo) => {
    let beats = 0
    let lastBeatOffset = 0
    let lastNumerator = 4
    let lastMeasureNumber = 0
  
    for (const ts of timeSignatureInfo) {
      const tsBeatOffset = ts.offset
      const tsNumerator = ts.numerator / (ts.denominator / 4)

      const measuresBeforeTS = (tsBeatOffset - lastBeatOffset) / lastNumerator
      const currentMeasureNumber = lastMeasureNumber + measuresBeforeTS
      
      if (measureNumber < currentMeasureNumber) break

      beats += (currentMeasureNumber - lastMeasureNumber) * lastNumerator
      lastBeatOffset = tsBeatOffset
      lastMeasureNumber = currentMeasureNumber
      lastNumerator = tsNumerator
    }
  
    beats += (measureNumber - lastMeasureNumber) * lastNumerator

    return beats
  }

export const getCurrentTempo = (beat, tempoInfo, speed, startMeasure) => {
    const absoluteBeat = beat + startMeasure
    let currentTempo = tempoInfo[0].bpm
    for (const t of tempoInfo) {
      if (absoluteBeat >= t.offset) {
        currentTempo = t.bpm
      } else {
        break
      }
    }
    return currentTempo * speed
  }

  export const getYPosition = (midiNote, minNotePitch, canvasHeight) => {
    return canvasHeight - (midiNote - minNotePitch + 2) * 10
  }