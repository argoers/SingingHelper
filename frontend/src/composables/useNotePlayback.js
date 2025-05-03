import { ref } from 'vue'
import Soundfont from 'soundfont-player'

export function useNotePlayback() {
  // Reactive state to track if a note is being played
  const isNoteBeingPlayed = ref(false)
  // Variable to store the current oscillator
  let currentNote = null

  // Variable to store the current audio context
  let player = null

  // Create a new audio context for playback
  const audioCtx = new window.AudioContext()

  // Function to load the instrument soundfont
  const loadInstrument = async () => {
    player = await Soundfont.instrument(audioCtx, 'choir_aahs')
  }

  // Function to play a note using the Soundfont player
  const playNote = async (midiNotes, isSnippet) => {
    if (!player) await loadInstrument()

    // If there was a previous note, stop it
    if (currentNote) currentNote.stop()

    // If there are no MIDI notes, exit the function
    if (!midiNotes || midiNotes.length === 0) return

    // Get the pitch (MIDI note number) of the first note
    isNoteBeingPlayed.value = true
    const midiNote = midiNotes[0].pitch
    const duration = isSnippet ? 1000 : 2 // seconds
     
    currentNote = player.play(midiNote, audioCtx.currentTime, { duration })

    setTimeout(() => {
      isNoteBeingPlayed.value = false
    }, duration * 1000)
  }


  // Return the state and function so they can be used in other parts of the application
  return {
    isNoteBeingPlayed, // Indicates if a note is being played
    playNote, // Function to play the first note
  }
}
