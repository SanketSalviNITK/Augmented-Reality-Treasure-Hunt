import { state } from './state.js';

export let supabaseClient = null;

function ensureClient() {
  if (!supabaseClient) {
    if (!window.supabase) {
      throw new Error("Supabase library failed to load. Check your network connection.");
    }
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = state.config;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase configuration missing!");
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

export async function uploadFile(file, folder) {
  ensureClient();
  const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
  const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabaseClient.storage
    .from('ar-assets')
    .upload(filePath, file);
    
  if (error) {
    console.error('Storage upload error:', error);
    throw error;
  }
  
  const { data: publicUrlData } = supabaseClient.storage
    .from('ar-assets')
    .getPublicUrl(filePath);
    
  return publicUrlData.publicUrl;
}

export async function uploadBase64Image(dataUrl, folder) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    return await uploadFile(file, folder);
  } catch (error) {
    console.error("Base64 Upload Error:", error);
    return null;
  }
}

export async function saveEventToDB(eventName, markers, timeLimit, theme) {
  const processedMarkers = [];
  ensureClient();
  
  for (let m of markers) {
    // Convert base64 dataUrl to File for image target
    const imgResponse = await fetch(m.dataUrl);
    const imgBlob = await imgResponse.blob();
    const imageFile = new File([imgBlob], 'marker.jpg', { type: 'image/jpeg' });
    
    const imageUrl = await uploadFile(imageFile, 'markers');
    
    let modelPublicUrl = null;
    let modelFileName = null;
    if (m.type === 'model' && typeof m.modelUrl === 'string' && m.modelUrl.startsWith('library:')) {
      // Built-in library asset: stored by reference, resolved locally on
      // every device — nothing to upload.
      modelPublicUrl = m.modelUrl;
      modelFileName = m.modelFileName || m.modelUrl;
    } else if (m.type === 'model' && m.modelFile) {
      modelPublicUrl = await uploadFile(m.modelFile, 'models');
      modelFileName = m.modelFile.name;
    }
    
    processedMarkers.push({
      type: m.type,
      scale: m.scale,
      color: m.color,
      text: m.text,
      hint: m.hint, // Sequential riddle text
      imageUrl: imageUrl,
      modelUrl: modelPublicUrl,
      modelFileName: modelFileName,
      pos: m.pos || null // normalized floor-plan position (spatial research)
    });
  }
  
  const eventData = {
    name: eventName,
    markers: processedMarkers,
    timeLimit: timeLimit || 0,
    theme: theme || 'standard',
    // Snapshot the creator's research settings into the event so they
    // actually reach hunters' devices (state.settings is per-browser).
    settings: {
      silentDashcam: state.settings.silentDashcam,
      mandatoryConsent: state.settings.mandatoryConsent,
      anonymizeHunters: state.settings.anonymizeHunters,
      randomizedPathing: state.settings.randomizedPathing,
      telemetryFrequency: state.settings.telemetryFrequency
    },
    players: []
  };

  // Optional venue floor plan for the marker pins above.
  if (state.floorPlan && state.floorPlan.file) {
    try {
      eventData.floorPlanUrl = await uploadFile(state.floorPlan.file, 'floorplans');
    } catch (err) {
      console.warn('Floor plan upload failed, positions kept without image:', err);
    }
  }

  // Reuse the buffer the creator already compiled during their AR test, so
  // hunters can download it instead of recompiling on-device.
  if (state.compiledBuffer) {
    try {
      const mindFile = new File([state.compiledBuffer], 'targets.mind', { type: 'application/octet-stream' });
      eventData.compiledMindUrl = await uploadFile(mindFile, 'compiled');
    } catch (err) {
      console.warn('Precompiled marker upload failed, hunters will compile on-device:', err);
    }
  }

  const { data, error } = await supabaseClient
    .from('events')
    .insert([{ data: eventData }])
    .select();
    
  if (error) {
    console.error('Database insert error:', error);
    return null;
  }
  return data[0];
}

export async function getEventsFromDB() {
  ensureClient();
  const { data, error } = await supabaseClient
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Database fetch error:', error);
    return [];
  }
  
  return data.map(row => ({
    id: row.id,
    ...row.data
  }));
}

export async function updateEventInDB(eventId, fullEventData) {
  ensureClient();
  const { error } = await supabaseClient
    .from('events')
    .update({ data: fullEventData })
    .eq('id', eventId);
    
  if (error) console.error('Error updating event:', error);
}

export async function deleteEventFromDB(eventId) {
  ensureClient();
  const { error } = await supabaseClient
    .from('events')
    .delete()
    .eq('id', eventId);
    
  if (error) console.error('Error deleting event:', error);
}

export async function saveFeedbackToDB(ratings) {
  ensureClient();
  const { data, error } = await supabaseClient
    .from('feedback')
    .insert([{ data: ratings }])
    .select();
    
  if (error) {
    console.error('Database feedback insert error:', error);
    return null;
  }
  return data[0];
}

export async function getFeedbackFromDB() {
  ensureClient();
  const { data, error } = await supabaseClient
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Database feedback fetch error:', error);
    return [];
  }

  return data.map(row => ({
    id: row.id,
    ...row.data
  }));
}

// Fire-and-forget: never throws, never blocks gameplay on a slow/failed
// network round-trip. Callers should not await this.
export function logTelemetry(eventId, participant, kind, marker = null, data = null) {
  try {
    ensureClient();
    supabaseClient
      .from('telemetry')
      .insert([{ event_id: eventId, participant, kind, marker, data }])
      .then(({ error }) => {
        if (error) console.warn('Telemetry insert error:', error);
      });
  } catch (err) {
    console.warn('Telemetry logging failed:', err);
  }
}

export async function getTelemetryRows() {
  ensureClient();
  const { data, error } = await supabaseClient
    .from('telemetry')
    .select('*')
    .order('ts', { ascending: true });

  if (error) {
    console.error('Telemetry fetch error:', error);
    return [];
  }

  return data;
}
