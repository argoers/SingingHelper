const API_BASE_URL = 'http://127.0.0.1:5001' // Base URL for the API

// Function to upload a MusicXML file to the server
export const uploadMusicXml = async (file) => {
  const formData = new FormData() // Create a form data object for the file upload
  formData.append('file', file) // Append the file to the form data

  try {
    // Send a POST request to upload the file
    const response = await fetch(`${API_BASE_URL}/upload-musicXml`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json() // Parse the JSON response

    if (!response.ok) {
      console.error('Ei saanud faili üles laetud:', data.error) // Log error if not OK
      return false
    }

    console.log('Fail edukalt üles laetud:', data.filename) // Log success message
    return true
  } catch (error) {
    console.error('Üleslaadimine ei läinud läbi:', error) // Log error if there is an exception
    return false
  }
}

// Function to get the start time and duration of a MusicXML file segment in seconds
export const getMusicXmlStartTimeAndDurationInSeconds = async (
  startMeasure,
  endMeasure,
  speed,
  partName,
) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-start-time-and-duration-in-seconds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_measure: startMeasure,
      end_measure: endMeasure,
      speed: speed,
      part_name: partName,
    }),
  })

  if (!response.ok) {
    throw new Error('Ei saanud serverist algusaja ja kestuse infot.') // Error if response is not OK
  }

  return await response.json() // Return the parsed JSON data
}

// Function to get MusicXML note information for a specific part and measure range
export const getMusicXmlNoteInfo = async (startMeasure, endMeasure, partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-note-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_measure: startMeasure,
      end_measure: endMeasure,
      part_name: partName,
    }),
  })

  if (!response.ok) {
    throw new Error('Ei saanud serverist MusicXML nootide infot.') // Error if response is not OK
  }

  return await response.json() // Return the parsed JSON data
}

// Function to extract pitches from the recorded audio
export const extractPitchesFromRecordedAudio = async (startMeasure, endMeasure) => {
  try {
    const response = await fetch(`${API_BASE_URL}/extract-pitches-from-recorded-audio`)

    const data = await response.json() // Parse the JSON response

    if (!response.ok) {
      throw new Error(data.error) // Throw an error if the response is not OK
    }

    if (!data.live_pitches) {
      throw new Error('Ei saanud serverist salvestatud nootide infot.') // Error if no live pitches data is found
    }

    const liveTimes = data.live_pitches.map((pitch) => pitch[0])
    const livePitches = data.live_pitches.map((pitch) => pitch[1])

    if (liveTimes.length === 0) {
      throw new Error('Mikrofon ei suutnud tuvastada heli.') // Error if no pitches are detected
    }

    // Adjust the number of points based on the number of bars in the music
    let numPoints = livePitches.length
    const numBars = endMeasure - startMeasure + 1

    while (numPoints % numBars !== 0) {
      numPoints += 1 // Adjust points to match bars
    }

    const duration = data.duration
    const timeStep = duration / numPoints // Calculate the time step between points
    const timeAxis = Array.from({ length: numPoints }, (_, i) => 0 + i * timeStep) // Create the time axis

    // Map the live pitches to the time axis
    const liveMapped = timeAxis.map((t) => {
      const closestIndex = liveTimes.findIndex((lt) => Math.abs(lt - t) < timeStep / 2)
      return closestIndex !== -1 ? livePitches[closestIndex] : null
    })

    return { liveNotes: liveMapped } // Return the mapped live notes
  } catch (error) {
    throw new Error(error.message) // Propagate any error that occurs
  }
}

// Function to record audio and send the data to the server
export const recordAudio = async (startMeasure, endMeasure, speed, partName, latencyBuffer) => {
  try {
    const response = await fetch(`${API_BASE_URL}/record-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_measure: startMeasure,
        end_measure: endMeasure,
        speed: speed,
        part_name: partName,
        latency_buffer: latencyBuffer,
      }),
    })

    const data = await response.json() // Parse the JSON response

    if (!response.ok) {
      throw new Error(data.error) // Error if response is not OK
    }

    return true
  } catch (error) {
    throw new Error('Ei saanud heli salvestada: ' + error.message) // Error if the recording fails
  }
}

// Function to get tempo information from the server
export const getTempoInfo = async () => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-tempo-info`)
  if (!response.ok) {
    throw new Error('Ei saanud serverist tempo infot.') // Error if response is not OK
  }
  return await response.json() // Return tempo info
}

// Function to get measure information for a specific part
export const getMeasureInfo = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-measure-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ part_name: partName }),
  })

  if (!response.ok) {
    throw new Error('Ei saanud serverist taktide infot.') // Error if response is not OK
  }
  return await response.json() // Return measure information
}

// Function to get time signature information for a specific part
export const getTimeSignatureInfo = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-time-signature-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ part_name: partName }),
  })

  if (!response.ok) {
    throw new Error('Ei saanud serverist taktimõõtude infot.') // Error if response is not OK
  }
  return await response.json() // Return time signature info
}

// Function to quit the application
export const quitApplication = async () => {
  const response = await fetch(`${API_BASE_URL}/quit-application`)
  if (!response.ok) {
    throw new Error('Ei saanud rakendust sulgeda.') // Error if response is not OK
  }
  return await response.json() // Return response
}

// Function to get part names from the server
export const getPartNames = async () => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-part-names`)
  if (!response.ok) {
    throw new Error('Ei saanud serverist partiide nimesid.') // Error if response is not OK
  }
  return await response.json() // Return part names
}

// Function to cancel the current process (e.g., stop recording)
export const cancel = async () => {
  const response = await fetch(`${API_BASE_URL}/end`)
  if (!response.ok) {
    throw new Error('Ei saanud salvestamist peatada.') // Error if response is not OK
  }
  return await response.json() // Return response
}
