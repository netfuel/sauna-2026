# SAUNA

Website for SAUNA — a queer disco party.

A dark, scrollable gallery built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Party photos and videos cascade in a 3D helix that twists as you scroll. Click any image to fly it into a full-screen lightbox; use the arrows (or ← →) to browse.

## Stack

- **Vite** — dev server + build
- **Three.js** — WebGL helix renderer
- **Proto Mono** — typeface
- No frameworks

## Dev

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Media pipeline

Place source images and videos in `/scripts/` input folder, then:

```bash
node scripts/process-media.mjs
```

Resizes images to 1400px JPEG, transcodes MOV → MP4, generates video poster frames, and writes `src/media-data.js`.

Requires [ffmpeg](https://ffmpeg.org/) installed system-wide (or the `ffmpeg-static` npm package handles it automatically).

## Build

```bash
npm run build
```

Output lands in `dist/`.
