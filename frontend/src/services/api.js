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

export const getMidiStartTimeAndDurationFromMeasures = async (startBar, endBar, tempo) => {
  const response = await fetch(`${API_BASE_URL}/get-midi-start-time-and-duration-from-measures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_bar: startBar, end_bar: endBar, tempo: tempo }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  
  return await response.json();
};

export const getMidiNotes = async (startBar, endBar, partName) => {
  const response = await fetch(`${API_BASE_URL}/get-midi-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_bar: startBar, end_bar: endBar, part_name: partName }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  
  return await response.json();
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

export const getBarInfo = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-bar-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ part_name: partName }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch bar range.");
  }
  return await response.json();
};

export const getTimeSignature = async (partName) => {
  const response = await fetch(`${API_BASE_URL}/get-time-signature`, {
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
  const response = await fetch(`${API_BASE_URL}/quit`);
  if (!response.ok) {
    throw new Error("Failed to fetch time signature.");
  }
  return await response.json();
};

export const getParts = async () => {
  const response = await fetch(`${API_BASE_URL}/get-parts`);
  if (!response.ok) {
    throw new Error("Failed to fetch part names.");
  }
  return await response.json();
};