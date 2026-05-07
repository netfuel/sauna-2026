export function initLightbox(lightboxEl) {
  const content = lightboxEl.querySelector('.lightbox-content');
  const closeBtn = lightboxEl.querySelector('.lightbox-close');
  const prevBtn = lightboxEl.querySelector('.lightbox-prev');
  const nextBtn = lightboxEl.querySelector('.lightbox-next');

  let currentIndex = 0;
  let allItems = [];

  function buildMedia(data) {
    if (data.type === 'image') {
      const el = document.createElement('img');
      el.src = data.src;
      el.alt = '';
      return el;
    } else {
      const el = document.createElement('video');
      el.src = data.src;
      el.controls = true;
      el.autoplay = true;
      el.muted = true;      // required for autoplay on Android Chrome
      el.playsInline = true;
      return el;
    }
  }

  function showMedia(data) {
    const v = content.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    content.innerHTML = '';
    const el = buildMedia(data);
    content.appendChild(el);
    if (el.tagName === 'VIDEO') el.play().catch(() => {});
  }

  function open(data, index, rect, items) {
    currentIndex = index;
    allItems = items;

    // Place flyer at mesh screen position before any animation
    const flyer = document.createElement('img');
    flyer.className = 'lightbox-flyer';
    flyer.src = data.type === 'image' ? data.src : (data.poster || data.src);
    Object.assign(flyer.style, {
      left: rect.x + 'px',
      top: rect.y + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
    document.body.appendChild(flyer);

    // Open backdrop and pre-load real content (invisible) behind the flyer
    content.innerHTML = '';
    const mediaEl = buildMedia(data);
    mediaEl.style.opacity = '0';
    content.appendChild(mediaEl);
    if (mediaEl.tagName === 'VIDEO') mediaEl.play().catch(() => {});

    lightboxEl.hidden = false;
    document.body.classList.add('lightbox-open');

    requestAnimationFrame(() => {
      // Fade in backdrop while image flies
      lightboxEl.classList.add('active');

      // Compute centered target preserving aspect ratio
      const aspect = rect.width / Math.max(rect.height, 1);
      const maxW = innerWidth * 0.8;
      const maxH = innerHeight * 0.8;
      let tw = maxW, th = maxW / aspect;
      if (th > maxH) { th = maxH; tw = maxH * aspect; }
      const tx = (innerWidth - tw) / 2;
      const ty = (innerHeight - th) / 2;

      flyer.classList.add('lightbox-flyer--fly');
      Object.assign(flyer.style, {
        left: tx + 'px',
        top: ty + 'px',
        width: tw + 'px',
        height: th + 'px',
      });

      // On arrival: crossfade flyer → real content, no blank frame
      flyer.addEventListener('transitionend', () => {
        flyer.style.transition = 'opacity 0.18s ease';
        flyer.style.opacity = '0';
        mediaEl.style.transition = 'opacity 0.18s ease';
        mediaEl.style.opacity = '1';
        setTimeout(() => flyer.remove(), 200);
      }, { once: true });
    });
  }

  function close() {
    lightboxEl.classList.remove('active');
    document.body.classList.remove('lightbox-open');
    const v = content.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    setTimeout(() => { lightboxEl.hidden = true; content.innerHTML = ''; }, 300);
  }

  function navigate(delta) {
    currentIndex = (currentIndex + delta + allItems.length) % allItems.length;
    showMedia(allItems[currentIndex]);
  }

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));
  lightboxEl.addEventListener('click', (e) => { if (e.target === lightboxEl) close(); });
  document.addEventListener('keydown', (e) => {
    if (lightboxEl.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  return { open };
}
