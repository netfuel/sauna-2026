import './style.css';
import lottie from 'lottie-web';
import { initGallery } from './gallery.js';
import { initLightbox } from './lightbox.js';

// --- Preloader ---
const preloaderEl = document.getElementById('preloader');
const lottieEl = document.getElementById('preloader-lottie');

const anim = lottie.loadAnimation({
  container: lottieEl,
  renderer: 'svg',
  loop: false,
  autoplay: false,
  path: '/lottie/preloader.json',
});

// Seek to frame 1 (ip) so trim paths show near-full circle while waiting
anim.addEventListener('DOMLoaded', () => anim.goToAndStop(1, true));

let dismissed = false;
function dismissPreloader() {
  if (dismissed) return;
  dismissed = true;
  anim.play();
  anim.addEventListener('complete', () => {
    preloaderEl.classList.add('fade-out');
    preloaderEl.addEventListener('transitionend', () => preloaderEl.remove(), { once: true });
  });
}

// Minimum display time so it feels intentional, not just a flash
const MIN_MS = 1200;
const startTime = Date.now();
window.addEventListener('load', () => {
  const elapsed = Date.now() - startTime;
  setTimeout(dismissPreloader, Math.max(0, MIN_MS - elapsed));
});
// Hard fallback in case load never fires
setTimeout(dismissPreloader, 4000);

// --- Gallery + lightbox ---
const { open: openLightbox } = initLightbox(document.getElementById('lightbox'));
initGallery(document.getElementById('gallery-spacer'), openLightbox);

// --- About modal ---
const aboutModal = document.getElementById('about-modal');
const aboutTrigger = document.querySelector('.about-trigger');
const aboutClose = document.querySelector('.about-close');

function openAbout() {
  aboutModal.hidden = false;
  document.body.classList.add('lightbox-open');
  requestAnimationFrame(() => aboutModal.classList.add('active'));
}
function closeAbout() {
  aboutModal.classList.remove('active');
  document.body.classList.remove('lightbox-open');
  aboutModal.addEventListener('transitionend', () => { aboutModal.hidden = true; }, { once: true });
}

aboutTrigger.addEventListener('click', openAbout);
aboutClose.addEventListener('click', closeAbout);
aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !aboutModal.hidden) closeAbout(); });

// Scroll cue — hide immediately since we start mid-helix
document.querySelector('.scroll-cue').style.opacity = '0';
