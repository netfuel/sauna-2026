import './style.css';
import { initGallery } from './gallery.js';
import { initLightbox } from './lightbox.js';

const { open: openLightbox } = initLightbox(document.getElementById('lightbox'));
initGallery(document.getElementById('gallery-spacer'), openLightbox);

const cue = document.querySelector('.scroll-cue');
window.addEventListener('scroll', () => {
  cue.style.opacity = window.scrollY > 80 ? '0' : '1';
}, { passive: true });
