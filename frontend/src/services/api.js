const API_BASE_URL = "http://127.0.0.1:5000";

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
      console.error("❌ File upload failed:", data.error);
      return false;
    }

    console.log("✅ File uploaded successfully:", data.filename);
    return true;
  } catch (error) {
    console.error("❌ Upload request failed:", error);
    return false;
  }
};

export const compareSinging = async (startBar, endBar) => {
  try {
    const response = await fetch(`${API_BASE_URL}/run-script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_bar: startBar, end_bar: endBar }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    if (!data.midi_notes || !data.live_pitches) {
      throw new Error("Missing data in API response");
    }

    const midiNotes = data.midi_notes.map((note) => ({
      start: note[0],
      end: note[1],
      pitch: note[2],
    }));

    const liveTimes = data.live_pitches.map((pitch) => pitch[0]);
    const livePitches = data.live_pitches.map((pitch) => pitch[1]);

    const allTimes = [
      ...midiNotes.map((n) => n.start),
      ...midiNotes.map((n) => n.end),
      ...liveTimes,
    ];

    if (allTimes.length === 0) {
      throw new Error("No valid time data available");
    }

    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);

    let numPoints = 100;
    const numBars = endBar - startBar + 1;
    while (numPoints % numBars !== 0) {
      numPoints += 1;
    }
    const timeStep = (maxTime - minTime) / numPoints;
    const timeAxis = Array.from({ length: numPoints }, (_, i) => minTime + i * timeStep);

    const midiMapped = timeAxis.map((t) => {
      const activeNote = midiNotes.find((note) => note.start <= t && t <= note.end);
      return activeNote ? activeNote.pitch : null;
    });

    const liveMapped = timeAxis.map((t) => {
      const closestIndex = liveTimes.findIndex((lt) => Math.abs(lt - t) < timeStep / 2);
      return closestIndex !== -1 ? livePitches[closestIndex] : null;
    });

    /*console.log("📊 Time Axis:", timeAxis);
    console.log("🎼 Mapped MIDI Pitches:", midiMapped);
    console.log("🎤 Mapped Live Pitches:", liveMapped);*/

    const barStep = numBars / numPoints;
    const barAxis = Array.from({ length: numPoints }, (_, i) => startBar + i * barStep);

    return {
      labels: barAxis.map((b, i) => (i % (numPoints / numBars) === 0 ? `Bar ${Math.round(b)}` : "")),
      datasets: [
        {
          label: "MIDI Notes",
          data: midiMapped,
          borderColor: "blue",
          backgroundColor: "blue",
          pointRadius: 0,
          fill: false,
          stepped: "before",
          spanGaps: true,
        },
        {
          label: "Sung Notes",
          data: liveMapped,
          borderColor: "red",
          backgroundColor: "red",
          pointRadius: 3,
          fill: false,
          stepped: "before",
          spanGaps: true,
        },
      ],
    };
  } catch (error) {
    throw new Error("Failed to compare singing: " + error.message);
  }
};

// ✅ Add Cancel Recording Function
export const cancelRecording = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cancel-recording`, {
      method: "POST",
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    console.log("❌ Recording canceled successfully.");
    return true;
  } catch (error) {
    console.error("❌ Failed to cancel recording:", error);
    return false;
  }
};