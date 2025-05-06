import { ref } from 'vue'

export function useNotePlayback(audioCtx, player) {
  // Reactive state to track if a note is being played
  const isNoteBeingPlayed = ref(false)
  // Variable to store the current note
  let currentNote = null

  // Function to play a note using the Soundfont player
  const playNote = async (midiNotes, isSnippet) => {
    // If there was a previous note, stop it
    if (currentNote) currentNote.stop()

    // If there are no MIDI notes, exit the function
    if (!midiNotes || midiNotes.length === 0) return

    // Get the pitch (MIDI note number) of the first note
    const midiNote = midiNotes[0].pitch
    const duration = isSnippet ? 1000 : 2 // seconds
     
    currentNote = player.play(midiNote, audioCtx.currentTime, { duration })

    // If the note is not a snippet, set the isNoteBeingPlayed state to true
    if (!isSnippet) {
      isNoteBeingPlayed.value = true
      setTimeout(() => {
        isNoteBeingPlayed.value = false
      }, duration * 1000)
    }
  }


  // Return the state and function so they can be used in other parts of the application
  return {
    isNoteBeingPlayed, // Indicates if a note is being played
    playNote, // Function to play the first note
  }
}
