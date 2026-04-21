/* ============================================================
   State Management
   ============================================================ */

export const state = {
  isAdmin: false,
  eventName: '',
  markerCount: 1,
  currentMarkerIndex: 0,
  markers: [],
  
  // Cropping
  rawImage: null,
  cropPos: { x: 50, y: 50, w: 300, h: 300 }, 
  
  // AR Session
  mindarThree: null,
  cameraStream: null,
  compiledBlobUrl: null,
  mixers: [],
};

export const ADMIN_PASSWORD = 'admin';
export const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.ply'];
