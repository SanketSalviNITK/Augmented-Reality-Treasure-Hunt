const { createClient } = window.supabase;

const supabaseUrl = 'https://bswsqfjhpkmbnnlqcxzy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzd3NxZmpocGttYm5ubHFjeHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjYyMDYsImV4cCI6MjA5MjM0MjIwNn0.jowT0Dn1D5qHEfW-jATjpIkDhVcfKI831dTWfmBjduI';

export const supabaseClient = createClient(supabaseUrl, supabaseKey);

export async function uploadFile(file, folder) {
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

export async function saveEventToDB(eventName, markers) {
  const processedMarkers = [];
  
  for (let m of markers) {
    // Convert base64 dataUrl to File for image target
    const imgResponse = await fetch(m.dataUrl);
    const imgBlob = await imgResponse.blob();
    const imageFile = new File([imgBlob], 'marker.jpg', { type: 'image/jpeg' });
    
    const imageUrl = await uploadFile(imageFile, 'markers');
    
    let modelPublicUrl = null;
    let modelFileName = null;
    if (m.type === 'model' && m.modelFile) {
      modelPublicUrl = await uploadFile(m.modelFile, 'models');
      modelFileName = m.modelFile.name;
    }
    
    processedMarkers.push({
      type: m.type,
      scale: m.scale,
      color: m.color,
      text: m.text,
      imageUrl: imageUrl, 
      modelUrl: modelPublicUrl,
      modelFileName: modelFileName
    });
  }
  
  const eventData = {
    name: eventName,
    markers: processedMarkers,
    players: []
  };
  
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
  const { error } = await supabaseClient
    .from('events')
    .update({ data: fullEventData })
    .eq('id', eventId);
    
  if (error) console.error('Error updating event:', error);
}

export async function deleteEventFromDB(eventId) {
  const { error } = await supabaseClient
    .from('events')
    .delete()
    .eq('id', eventId);
    
  if (error) console.error('Error deleting event:', error);
}
