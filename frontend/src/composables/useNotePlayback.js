import { ref } from 'vue'

export function useNotePlayback(midiNotesRef) {
  const isNoteBeingPlayed = ref(false)

  const playFirstNote = () => {
    const midiNotes = midiNotesRef.value
    if (!midiNotes || midiNotes.length === 0) return

    const firstNoteFrequency = midiNotes[0].pitch
    const frequencyHz = 440 * Math.pow(2, (firstNoteFrequency - 69) / 12)

    const audioCtx = new window.AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.frequency.setValueAtTime(frequencyHz, audioCtx.currentTime)
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime)

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.start()
    isNoteBeingPlayed.value = true

    oscillator.stop(audioCtx.currentTime + 2)
    oscillator.onended = () => {
      isNoteBeingPlayed.value = false
    }
  }

  return {
    isNoteBeingPlayed,
    playFirstNote,
  }
}