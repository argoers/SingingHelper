const API_BASE_URL = "http://127.0.0.1:5001";

export const uploadMusicXml = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload-musicXml`, {
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

export const getMusicXmlStartTimeAndDurationInSeconds = async (startMeasure, endMeasure, speed, partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-start-time-and-duration-in-seconds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_measure: startMeasure, end_measure: endMeasure, speed: speed, part_name: partName }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  
  return await response.json();
};

export const getMusicXmlNoteInfo = async (startMeasure, endMeasure, partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-note-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_measure: startMeasure, end_measure: endMeasure, part_name: partName }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  
  return await response.json();
};

export const extractPitchesFromRecordedAudio = async (startMeasure, endMeasure) => {
  try {
    const response = await fetch(`${API_BASE_URL}/extract-pitches-from-recorded-audio`);

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
    const numBars = endMeasure - startMeasure + 1;

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

export const recordAudio = async (startMeasure, endMeasure, speed, partName, latencyBuffer) => {
  try {
    const response = await fetch(`${API_BASE_URL}/record-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_measure: startMeasure, end_measure: endMeasure, speed: speed, part_name: partName, latency_buffer: latencyBuffer}),
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

export const getTempoInfo = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-tempo-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ part_name: partName }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch tempo info.");
  }
  return await response.json();
};

export const getMeasureInfo = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-measure-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ part_name: partName }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch measure info.");
  }
  return await response.json();
};

export const getTimeSignatureInfo = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-time-signature-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ part_name: partName }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  return await response.json();
};

export const quitApplication = async () => {
  const response = await fetch(`${API_BASE_URL}/quit-application`);
  if (!response.ok) {
    throw new Error("Failed to fetch time signature.");
  }
  return await response.json();
};

export const getPartNames = async () => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-part-names`);
  if (!response.ok) {
    throw new Error("Failed to fetch part names.");
  }
  return await response.json();
};

export const cancel = async () => {
  const response = await fetch(`${API_BASE_URL}/end`);
  if (!response.ok) {
    throw new Error("Failed to end.");
  }
  return await response.json();
};