const API_BASE_URL = "http://127.0.0.1:5001";

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload-midi`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("File upload failed:", data.error);
      return false;
    }

    console.log("File uploaded successfully:", data.filename);
    return true;
  } catch (error) {
    console.error("Upload request failed:", error);
    return false;
  }
};

export const getMidiFileInfo = async (startBar, endBar, numberOfLabelPoints) => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-midi-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_bar: startBar, end_bar: endBar }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    const midiNotes = data.midi_notes.map((note) => ({
      start: note[0],
      end: note[1],
      pitch: note[2],
    }));
    
    if (!numberOfLabelPoints) return { midiNotes: data.midi_notes }
    let numPoints = numberOfLabelPoints;
    const numBars = endBar - startBar + 1;
    while (numPoints % numBars !== 0) {
      numPoints += 1;
    }

    const startTime = data.start_time
    const timeStep = data.duration / numPoints;
    const timeAxis = Array.from({ length: numPoints }, (_, i) => startTime + i * timeStep);

    const midiMapped = timeAxis.map((t) => {
      const activeNote = midiNotes.find((note) => note.start <= t && t <= note.end);
      return activeNote ? activeNote.pitch : null;
    });

    const barStep = numBars / numPoints;
    const barAxis = Array.from({ length: numPoints }, (_, i) => startBar + i * barStep);
    const labels = barAxis.map((b, i) => (i % (numPoints / numBars) === 0 ? `Bar ${Math.round(b)}` : ""));

    return { labels: labels, midiNotesPoints: midiMapped, midiNotes: data.midi_notes }
  } catch (error) {
    console.error("❌ Upload request failed:", error);
    return false;
  }
};

export const getMidiNotes = async (startBar, endBar) => {
  const data = await getMidiFileInfo(startBar, endBar, null);
  return { midiNotes: data.midiNotes }
};

export const extractPitchesFromAudio = async (startBar, endBar) => {
  try {
    const response = await fetch(`${API_BASE_URL}/extract`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    if (!data.live_pitches) {
      throw new Error("No pitches extracted from the audio.");
    }

    const liveTimes = data.live_pitches.map((pitch) => pitch[0]);
    const livePitches = data.live_pitches.map((pitch) => pitch[1]);

    if (liveTimes.length === 0) {
      throw new Error("Please sing into the microphone to extract pitches.");
    }

    let numPoints = livePitches.length;
    const numBars = endBar - startBar + 1;

    while (numPoints % numBars !== 0) {
      numPoints += 1;
    }
    const duration = data.duration;
    const timeStep = duration / numPoints;
    const timeAxis = Array.from({ length: numPoints }, (_, i) => 0 + i * timeStep);
    const liveMapped = timeAxis.map((t) => {
      const closestIndex = liveTimes.findIndex((lt) => Math.abs(lt - t) < timeStep / 2);
      return closestIndex !== -1 ? livePitches[closestIndex] : null;
    });
    
    return { liveNotes: liveMapped };

  } catch (error) {
    throw new Error(error.message);
  }
}

export const recordAudio = async (startBar, endBar, tempo) => {
  try {
    const response = await fetch(`${API_BASE_URL}/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_bar: startBar, end_bar: endBar, tempo: tempo}),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    return true;
  } catch (error) {
    throw new Error("Failed to compare singing: " + error.message);
  }
};

export const getTempo = async () => {
  const response = await fetch(`${API_BASE_URL}/get-tempo`);
  if (!response.ok) {
    throw new Error("Failed to fetch tempo.");
  }
  return await response.json();
};

export const getBarTotal = async () => {
  const response = await fetch(`${API_BASE_URL}/get-bar-total`);
  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  return await response.json();
};

export const getTimeSignature = async () => {
  const response = await fetch(`${API_BASE_URL}/get-time-signature`);
  if (!response.ok) {
    throw new Error("Failed to fetch time signature.");
  }
  return await response.json();
};

export const quitApplication = async () => {
  const response = await fetch(`${API_BASE_URL}/quit`);
  if (!response.ok) {
    throw new Error("Failed to fetch time signature.");
  }
  return await response.json();
};