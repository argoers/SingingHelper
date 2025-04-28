import { ref } from 'vue'

export function useNotePlayback(midiNotesRef) {
  // Reactive state to track if a note is being played
  const isNoteBeingPlayed = ref(false)

  // Function to play the first note in the midiNotes array
  const playFirstNote = () => {
    const midiNotes = midiNotesRef.value // Get the MIDI notes array
    if (!midiNotes || midiNotes.length === 0) return // Exit if there are no notes

    // Get the pitch (MIDI note number) of the first note
    const firstNoteFrequency = midiNotes[0].pitch

    // Convert MIDI note number to frequency (in Hz) for playback
    const frequencyHz = 440 * Math.pow(2, (firstNoteFrequency - 69) / 12)

    // Create a new audio context for playback
    const audioCtx = new window.AudioContext()

    // Create an oscillator to generate a sound wave at the calculated frequency
    const oscillator = audioCtx.createOscillator()

    // Create a gain node to control the volume of the sound
    const gainNode = audioCtx.createGain()

    // Set the frequency of the oscillator to the calculated frequency
    oscillator.frequency.setValueAtTime(frequencyHz, audioCtx.currentTime)

    // Set the gain (volume) of the sound to 1 (full volume)
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime)

    // Connect the oscillator to the gain node and the gain node to the audio context's output
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    // Start the oscillator (playing the sound)
    oscillator.start()

    // Mark that a note is being played
    isNoteBeingPlayed.value = true

    // Stop the oscillator after 2 seconds (duration of the note)
    oscillator.stop(audioCtx.currentTime + 2)

    // When the note stops, update the state to indicate that no note is being played
    oscillator.onended = () => {
      isNoteBeingPlayed.value = false
    }
  }

  // Return the state and function so they can be used in other parts of the application
  return {
    isNoteBeingPlayed, // Indicates if a note is being played
    playFirstNote, // Function to play the first note
  }
}
