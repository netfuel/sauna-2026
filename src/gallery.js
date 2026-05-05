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
const FADE_STAGGER = 55;   // ms between each item starting to fade in
const FADE_DURATION = 500; // ms for each item's fade

const DISCO_BALL = { src: '/media/hero/disco-ball.jpg', type: 'image', width: 2200, height: 2800 };

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

  const totalScroll = Math.ceil(items.length * V_SPACING / CAMERA_SPEED) + window.innerHeight;
  spacerEl.style.height = totalScroll + 'px';

  const canvas = document.createElement('canvas');
  canvas.id = 'gallery-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 10000);
  camera.position.set(0, 0, CAMERA_Z);

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
    const mat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { index: i, data, fadeStart: performance.now() + i * FADE_STAGGER };
    scene.add(mesh);
    planes.push(mesh);

    const texSrc = data.type === 'image' ? data.src : (data.poster || null);
    if (texSrc) {
      loader.load(texSrc, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        // Preserve current opacity so the swap doesn't cause a flash
        mesh.material = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: mesh.material.opacity,
        });
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

  // Pointer cursor on hover
  canvas.addEventListener('mousemove', (e) => {
    canvas.style.cursor = doRaycast(e.clientX, e.clientY).length ? 'pointer' : 'default';
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

  let smoothScroll = 0;

  function frame() {
    smoothScroll += (window.scrollY - smoothScroll) * LERP;
    const twist = smoothScroll * TWIST_PER_PX;

    camera.position.y = -smoothScroll * CAMERA_SPEED;
    camera.updateMatrixWorld();

    const now = performance.now();
    planes.forEach((mesh, i) => {
      const angle = i * ANGLE_STEP + twist;
      mesh.position.set(
        Math.cos(angle) * RADIUS,
        VERTICAL_START - i * V_SPACING,
        Math.sin(angle) * RADIUS
      );
      mesh.lookAt(camera.position);
      mesh.quaternion.multiply(tiltQuats[i]);

      // Sequential spiral fade-in (smoothstep easing)
      if (mesh.material.opacity < 1) {
        const elapsed = now - mesh.userData.fadeStart;
        if (elapsed > 0) {
          const t = Math.min(elapsed / FADE_DURATION, 1);
          mesh.material.opacity = t * t * (3 - 2 * t);
        }
      }
    });

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
