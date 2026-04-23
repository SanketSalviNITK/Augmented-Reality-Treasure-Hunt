import * as THREE from 'three';

let animationFrameId;
let isActive = true;

export function initLandingAnimation() {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  container.innerHTML = '';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x09090b, 0.04);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 12;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const isMobile = window.innerWidth <= 768;
  const avatarOffset = isMobile ? 3 : 6;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  const creatorLight = new THREE.PointLight(0x6366f1, 2, 30);
  creatorLight.position.set(isMobile ? 0 : -avatarOffset, isMobile ? avatarOffset : 3, 4);
  scene.add(creatorLight);

  const hunterLight = new THREE.PointLight(0x10b981, 2, 30);
  hunterLight.position.set(isMobile ? 0 : avatarOffset, isMobile ? -avatarOffset : 3, 4);
  scene.add(hunterLight);

  const creatorGroup = new THREE.Group();
  creatorGroup.position.set(isMobile ? 0 : -avatarOffset, isMobile ? avatarOffset : 0, 0);
  scene.add(creatorGroup);

  const crystalGeo = new THREE.OctahedronGeometry(2, 0);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xa5b4fc,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 2.0,
    wireframe: true
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  creatorGroup.add(crystal);

  const coreGeo = new THREE.IcosahedronGeometry(1.2, 1);
  const coreMat = new THREE.MeshStandardMaterial({ 
    color: 0x4f46e5,
    emissive: 0x3730a3,
    emissiveIntensity: 0.5,
    roughness: 0.4
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  creatorGroup.add(core);

  const hunterGroup = new THREE.Group();
  hunterGroup.position.set(isMobile ? 0 : avatarOffset, isMobile ? -avatarOffset : 0, 0);
  scene.add(hunterGroup);

  const ringGeo = new THREE.TorusGeometry(1.8, 0.15, 16, 64);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.9,
    roughness: 0.1,
  });
  const ring = new THREE.Mesh(ringGeo, goldMat);
  hunterGroup.add(ring);
  
  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 16, 64), goldMat);
  hunterGroup.add(ringInner);

  const pointerGeo = new THREE.TetrahedronGeometry(0.8, 0);
  const pointerMat = new THREE.MeshStandardMaterial({ 
    color: 0x34d399, 
    emissive: 0x059669,
    metalness: 0.5, 
    roughness: 0.1 
  });
  const pointer = new THREE.Mesh(pointerGeo, pointerMat);
  pointer.scale.set(0.5, 1.5, 0.5);
  hunterGroup.add(pointer);

  const particlesGeo = new THREE.BufferGeometry();
  const particlesCount = 300;
  const posArray = new Float32Array(particlesCount * 3);
  for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 30;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particlesMat = new THREE.PointsMaterial({
    size: 0.06,
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  let targetCreatorScale = 1;
  let targetHunterScale = 1;
  let targetCameraX = 0;
  let targetCameraY = 0;
  let targetCameraZ = 12;

  const panelCreator = document.getElementById('panel-creator');
  const panelHunter = document.getElementById('panel-hunter');

  if (panelCreator) {
    panelCreator.addEventListener('mouseenter', () => {
      targetCreatorScale = 1.25;
      targetHunterScale = 0.85;
      if (window.innerWidth > 768) {
        targetCameraX = -2;
      } else {
        targetCameraY = 2;
      }
      targetCameraZ = 10;
      creatorLight.intensity = 5;
    });
    panelCreator.addEventListener('mouseleave', () => {
      targetCreatorScale = 1;
      targetHunterScale = 1;
      targetCameraX = 0;
      targetCameraY = 0;
      targetCameraZ = 12;
      creatorLight.intensity = 2;
    });
  }

  if (panelHunter) {
    panelHunter.addEventListener('mouseenter', () => {
      targetHunterScale = 1.25;
      targetCreatorScale = 0.85;
      if (window.innerWidth > 768) {
        targetCameraX = 2;
      } else {
        targetCameraY = -2;
      }
      targetCameraZ = 10;
      hunterLight.intensity = 5;
    });
    panelHunter.addEventListener('mouseleave', () => {
      targetHunterScale = 1;
      targetCreatorScale = 1;
      targetCameraX = 0;
      targetCameraY = 0;
      targetCameraZ = 12;
      hunterLight.intensity = 2;
    });
  }

  const clock = new THREE.Clock();
  
  function animate() {
    if (!isActive) return;
    animationFrameId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    crystal.rotation.x = time * 0.4;
    crystal.rotation.y = time * 0.2;
    core.rotation.y = -time * 0.6;
    core.rotation.z = time * 0.3;
    
    ring.rotation.x = Math.sin(time * 0.5) * 0.5;
    ring.rotation.y = time * 0.5;
    ringInner.rotation.x = Math.cos(time * 0.5) * 0.5;
    ringInner.rotation.y = -time * 0.3;
    pointer.rotation.y = time * 1.2;

    const isMob = window.innerWidth <= 768;
    const off = isMob ? 3 : 6;
    creatorGroup.position.y = (isMob ? off : 0) + Math.sin(time * 1.5) * 0.3;
    hunterGroup.position.y = (isMob ? -off : 0) + Math.cos(time * 1.5) * 0.3;

    creatorGroup.scale.lerp(new THREE.Vector3(targetCreatorScale, targetCreatorScale, targetCreatorScale), 0.08);
    hunterGroup.scale.lerp(new THREE.Vector3(targetHunterScale, targetHunterScale, targetHunterScale), 0.08);
    
    camera.position.x += (targetCameraX - camera.position.x) * 0.05;
    camera.position.y += (targetCameraY - camera.position.y) * 0.05;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.05;
    camera.lookAt(0, 0, 0);

    particles.rotation.y = time * 0.02;

    renderer.render(scene, camera);
  }
  
  isActive = true;
  animate();

  window.addEventListener('resize', () => {
    if (!isActive) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const isMob = window.innerWidth <= 768;
    const off = isMob ? 3 : 6;
    creatorGroup.position.x = isMob ? 0 : -off;
    hunterGroup.position.x = isMob ? 0 : off;
    creatorLight.position.set(isMob ? 0 : -off, isMob ? off : 3, 4);
    hunterLight.position.set(isMob ? 0 : off, isMob ? -off : 3, 4);
  });
}

export function stopLandingAnimation() {
  isActive = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
}
