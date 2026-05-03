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

  // Dynamic Configuration
  config: {
    GEMINI_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
  }
};

export const ADMIN_PASSWORD = 'ARTHunt321';
export const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.ply'];
