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

const cue = document.querySelector('.scroll-cue');
window.addEventListener('scroll', () => {
  cue.style.opacity = window.scrollY > 80 ? '0' : '1';
}, { passive: true });
