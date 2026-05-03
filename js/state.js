/* ============================================================
   State Management
   ============================================================ */

export const state = {
  isAdmin: false,
  eventName: '',
  markerCount: 1,
  timeLimit: 0,
  theme: 'standard',
  currentMarkerIndex: 0,
  markers: [],
  events: [], // Stores saved events
  
  
  // Cropping
  rawImage: null,
  cropPos: { x: 50, y: 50, w: 300, h: 300 }, 
  
  // AR Session
  mindarThree: null,
  cameraStream: null,
  compiledBlobUrl: null,
  mixers: [],
  activePlayerRecord: null,
  activeEventId: null,
  audioEnabled: true,
  
  // Dynamic Configuration (to prevent 404 hangs on public deploys)
  config: {
    GEMINI_API_KEY: 'AIzaSyAewtxOOky2nN4A6ryCFkS5fwSfvMFc750',
    SUPABASE_URL: 'https://bswsqfjhpkmbnnlqcxzy.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzd3NxZmpocGttYm5ubHFjeHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjYyMDYsImV4cCI6MjA5MjM0MjIwNn0.jowT0Dn1D5qHEfW-jATjpIkDhVcfKI831dTWfmBjduI'
  }
};

export const ADMIN_PASSWORD = 'ARTHunt321';
export const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.ply'];
