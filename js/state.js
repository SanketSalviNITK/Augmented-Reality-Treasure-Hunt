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
  compiledMindUrl: null, // URL of precompiled .mind data for the active event
  compiledBuffer: null, // raw compiled buffer from the last on-device compilation
  floorPlan: null, // { dataUrl, file } venue floor plan for marker pinning (optional)
  pricing: { paid: false, price: 0 }, // event access model (scaffold; enforcement lands with payments)
  mixers: [],
  activePlayerRecord: null,
  activeEventId: null,
  audioEnabled: true,

  // Research & Framework Settings
  settings: JSON.parse(localStorage.getItem('arthunt_settings')) || {
    silentDashcam: true,
    telemetryFrequency: 1000,
    mandatoryConsent: true,
    anonymizeHunters: false,
    globalQuestTimer: 15,
    randomizedPathing: true
  },

  // Dynamic Configuration
  config: {
    GEMINI_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
  }
};

export const ADMIN_PASSWORD = 'ARTHunt321';
export const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.ply'];
