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
      console.error("Ei saanud faili üles laetud:", data.error);
      return false;
    }

    console.log("Fail edukalt üles laetud:", data.filename);
    return true;
  } catch (error) {
    console.error("Üleslaadimine ei läinud läbi:", error);
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
    throw new Error("Ei saanud serverist algusaja ja kestuse infot.");
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
    throw new Error("Ei saanud serverist MusicXML nootide infot.");
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
      throw new Error("Ei saanud serverist salvestatud nootide infot.");
    }

    const liveTimes = data.live_pitches.map((pitch) => pitch[0]);
    const livePitches = data.live_pitches.map((pitch) => pitch[1]);

    if (liveTimes.length === 0) {
      throw new Error("Mikrofon ei suutnud tuvastada heli.");
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
    throw new Error("Ei saanud heli salvestada: " + error.message);
  }
};

export const getTempoInfo = async () => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-tempo-info`);
  if (!response.ok) {
    throw new Error("Ei saanud serverist tempo infot.");
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
    throw new Error("Ei saanud serverist taktide infot.");
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
    throw new Error("Ei saanud serverist taktimõõtude infot.");
  }
  return await response.json();
};

export const quitApplication = async () => {
  const response = await fetch(`${API_BASE_URL}/quit-application`);
  if (!response.ok) {
    throw new Error("Ei saanud rakendust sulgeda.");
  }
  return await response.json();
};

export const getPartNames = async () => {
  const response = await fetch(`${API_BASE_URL}/get-musicXml-part-names`);
  if (!response.ok) {
    throw new Error("Ei saanud serverist partiide nimesid.");
  }
  return await response.json();
};

export const cancel = async () => {
  const response = await fetch(`${API_BASE_URL}/end`);
  if (!response.ok) {
    throw new Error("Ei saanud salvestamist peatada.");
  }
  return await response.json();
};