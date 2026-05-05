import * as THREE from 'three';
import { galleryItems } from './media-data.js';

const RADIUS = 280;
const V_SPACING = 140;
const ANGLE_STEP = 137.5 * (Math.PI / 180);
const TWIST_PER_PX = 0.0011;
const CAMERA_Z = 950;
const CAMERA_SPEED = 0.35;
const BASE_WIDTH = 90;
const WIDTH_VARIANCE = 150;
const LERP = 0.07;
const VERTICAL_START = 420;
const AUTO_SCROLL_PX = 0.5;   // px per frame when idle (~30px/s at 60fps)
const IDLE_DELAY = 1200;       // ms of no input before auto-scroll resumes

// Intro camera animation: dramatic overhead arc → normal
const INTRO_DURATION  = 3600;
const INTRO_Y_OFFSET  = 1100;
const INTRO_Z_OFFSET  = 700;
const INTRO_X_OFFSET  = 350;
const INTRO_TILT      = -0.45;
const INTRO_FOV_START = 85;
const INTRO_FOV_END   = 55;

const DISCO_BALL = { src: '/media/hero/disco-ball.jpg', type: 'image', width: 2200, height: 2800 };

// Hover constants
const HOVER_SCALE = 1.08;
const HOVER_LERP  = 0.10;

function runtimeShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns the screen-space rect {x,y,width,height} of a billboarded mesh
function getScreenRect(mesh, camera) {
  const pos = mesh.position.clone().project(camera);
  const cx = (pos.x * 0.5 + 0.5) * innerWidth;
  const cy = (-pos.y * 0.5 + 0.5) * innerHeight;
  const dist = mesh.position.distanceTo(camera.position);
  const fovRad = camera.fov * Math.PI / 180;
  const unitsPerPx = (2 * dist * Math.tan(fovRad / 2)) / innerHeight;
  const sw = mesh.geometry.parameters.width / unitsPerPx;
  const sh = mesh.geometry.parameters.height / unitsPerPx;
  return { x: cx - sw / 2, y: cy - sh / 2, width: sw, height: sh };
}

export function initGallery(spacerEl, onItemClick) {
  const items = [DISCO_BALL, ...runtimeShuffle(galleryItems)];

  // Infinite scroll — items loop via modulo positioning
  spacerEl.style.height = '9999999px';
  const totalHeight = items.length * V_SPACING;

  // Start scroll at the middle of the helix so the user never sees an edge
  const midScroll = Math.round((items.length / 2) * V_SPACING / CAMERA_SPEED);
  window.scrollTo(0, midScroll);

  const canvas = document.createElement('canvas');
  canvas.id = 'gallery-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 10000);
  camera.position.set(INTRO_X_OFFSET, INTRO_Y_OFFSET, CAMERA_Z + INTRO_Z_OFFSET);
  camera.rotation.x = INTRO_TILT;
  camera.fov = INTRO_FOV_START;
  camera.updateProjectionMatrix();
  const introStart = performance.now() + 600;

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  const tiltQuats = items.map((_, i) => {
    const deg = Math.sin(i * 2.399) * 6;
    return new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      deg * (Math.PI / 180)
    );
  });

  const loader = new THREE.TextureLoader();
  const planes = [];

  items.forEach((data, i) => {
    const aspect = (data.width || 1) / (data.height || 1);
    const jitter = ((i * 2654435761) % 1000) / 1000;
    const w = BASE_WIDTH + jitter * WIDTH_VARIANCE;
    const h = w / Math.max(aspect, 0.1);

    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { index: i, data, hovered: false, currentScale: 1.0 };
    scene.add(mesh);
    planes.push(mesh);

    const texSrc = data.type === 'image' ? data.src : (data.poster || null);
    if (texSrc) {
      loader.load(texSrc, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mesh.material = new THREE.MeshBasicMaterial({ map: tex });
      });
    }
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function doRaycast(clientX, clientY) {
    mouse.set(
      (clientX / innerWidth) * 2 - 1,
      -(clientY / innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(planes, false);
  }

  // Hover tracking — updates hovered flag on the mesh for the frame loop
  let hoveredMesh = null;
  canvas.addEventListener('mousemove', (e) => {
    const hits = doRaycast(e.clientX, e.clientY);
    const next = hits.length ? hits[0].object : null;
    if (next !== hoveredMesh) {
      if (hoveredMesh) hoveredMesh.userData.hovered = false;
      hoveredMesh = next;
      if (hoveredMesh) hoveredMesh.userData.hovered = true;
    }
    canvas.style.cursor = hits.length ? 'pointer' : 'default';
  });
  canvas.addEventListener('mouseleave', () => {
    if (hoveredMesh) hoveredMesh.userData.hovered = false;
    hoveredMesh = null;
  });

  // Click (desktop)
  canvas.addEventListener('click', (e) => {
    const hits = doRaycast(e.clientX, e.clientY);
    if (hits.length) {
      const mesh = hits[0].object;
      const rect = getScreenRect(mesh, camera);
      onItemClick(mesh.userData.data, mesh.userData.index, rect, items);
    }
  });

  // Tap (mobile) — 24px threshold handles Android jitter; time guard rejects slow drags
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    const dt = Date.now() - touchStartTime;
    if (dx < 24 && dy < 24 && dt < 600) {
      const hits = doRaycast(t.clientX, t.clientY);
      if (hits.length) {
        const mesh = hits[0].object;
        const rect = getScreenRect(mesh, camera);
        onItemClick(mesh.userData.data, mesh.userData.index, rect, items);
      }
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  let smoothScroll = midScroll;

  // Auto-scroll: resume slow drift after user stops interacting
  let lastManualScroll = Date.now();
  function onManualInput() { lastManualScroll = Date.now(); }
  window.addEventListener('wheel',      onManualInput, { passive: true });
  window.addEventListener('touchstart', onManualInput, { passive: true });
  window.addEventListener('touchmove',  onManualInput, { passive: true });
  window.addEventListener('keydown',    onManualInput);

  function frame() {
    const now = performance.now();

    // Nudge DOM scroll forward when user is idle (infinite spacer = no clamping)
    if (Date.now() - lastManualScroll > IDLE_DELAY) {
      window.scrollBy(0, AUTO_SCROLL_PX);
    }

    smoothScroll += (window.scrollY - smoothScroll) * LERP;
    const twist = smoothScroll * TWIST_PER_PX;

    // Intro camera arc: dramatic overhead → default
    const rawT = Math.min(Math.max((now - introStart) / INTRO_DURATION, 0), 1);
    const t = rawT < 0.5
      ? 8 * rawT * rawT * rawT * rawT
      : 1 - Math.pow(-2 * rawT + 2, 4) / 2;
    const rem = 1 - t;

    camera.position.x = rem * INTRO_X_OFFSET;
    camera.position.y = -smoothScroll * CAMERA_SPEED + rem * INTRO_Y_OFFSET;
    camera.position.z = CAMERA_Z + rem * INTRO_Z_OFFSET;
    camera.rotation.x = rem * INTRO_TILT;
    camera.fov = INTRO_FOV_END + rem * (INTRO_FOV_START - INTRO_FOV_END);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const camWorldY = -smoothScroll * CAMERA_SPEED;

    planes.forEach((mesh, i) => {
      const angle = i * ANGLE_STEP + twist;

      // Loop item Y to always stay near the camera
      const naturalY = VERTICAL_START - i * V_SPACING;
      const shift = Math.round((camWorldY - naturalY) / totalHeight) * totalHeight;
      const itemY = naturalY + shift;

      mesh.position.set(
        Math.cos(angle) * RADIUS,
        itemY,
        Math.sin(angle) * RADIUS
      );
      mesh.lookAt(camera.position);
      mesh.quaternion.multiply(tiltQuats[i]);

      // Hover: lerp scale
      const targetScale = mesh.userData.hovered ? HOVER_SCALE : 1.0;
      mesh.userData.currentScale += (targetScale - mesh.userData.currentScale) * HOVER_LERP;
      mesh.scale.setScalar(mesh.userData.currentScale);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
