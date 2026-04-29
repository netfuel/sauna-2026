// Resize images, transcode/copy videos, generate posters, emit src/media-data.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const SRC_DIR = '/Users/matthewladner/Desktop/sauna-site-2026/site images';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_GALLERY = path.join(ROOT, 'public/media/gallery');
const OUT_VIDEO = path.join(ROOT, 'public/media/video');
const DATA_FILE = path.join(ROOT, 'src/media-data.js');

const MAX_EDGE = 1400;
const JPEG_QUALITY = 82;
const VIDEO_SIZE_WARN = 30 * 1024 * 1024;
const VIDEO_SIZE_SKIP = 100 * 1024 * 1024;

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png']);
const VID_EXT = new Set(['.mp4', '.mov']);

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => err += d.toString());
    p.on('exit', c => c === 0 ? resolve() : reject(new Error(err)));
  });
}

async function ffprobeSize(file) {
  // Use ffmpeg to dump dims by running -i and parsing stderr
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath, ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let out = '';
    p.stderr.on('data', d => out += d.toString());
    p.on('exit', () => {
      const m = out.match(/(\d{2,5})x(\d{2,5})/);
      resolve(m ? { w: +m[1], h: +m[2] } : { w: 1920, h: 1080 });
    });
  });
}

async function processImage(srcPath, name) {
  const outName = slug(name.replace(/\.[^.]+$/, '')) + '.jpg';
  const outPath = path.join(OUT_GALLERY, outName);
  const img = sharp(srcPath, { failOnError: false }).rotate();
  const meta = await img.metadata();
  const longEdge = Math.max(meta.width, meta.height);
  const resize = longEdge > MAX_EDGE
    ? (meta.width >= meta.height
        ? { width: MAX_EDGE }
        : { height: MAX_EDGE })
    : null;
  let pipeline = sharp(srcPath, { failOnError: false }).rotate();
  if (resize) pipeline = pipeline.resize(resize);
  await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outPath);
  const finalMeta = await sharp(outPath).metadata();
  return {
    src: `/media/gallery/${outName}`,
    type: 'image',
    width: finalMeta.width,
    height: finalMeta.height,
  };
}

async function processVideo(srcPath, name) {
  const stat = await fs.stat(srcPath);
  if (stat.size > VIDEO_SIZE_SKIP) {
    console.warn(`  ⚠ skipping ${name} (${(stat.size / 1024 / 1024).toFixed(0)}MB > 100MB)`);
    return null;
  }
  if (stat.size > VIDEO_SIZE_WARN) {
    console.warn(`  ⚠ ${name} is large (${(stat.size / 1024 / 1024).toFixed(0)}MB) — consider trimming`);
  }
  const base = slug(name.replace(/\.[^.]+$/, ''));
  const outVideo = path.join(OUT_VIDEO, base + '.mp4');
  const outPoster = path.join(OUT_VIDEO, base + '.jpg');
  const ext = path.extname(name).toLowerCase();

  if (ext === '.mp4') {
    // Just remux to ensure faststart for web streaming
    await runFfmpeg(['-y', '-i', srcPath, '-c', 'copy', '-movflags', '+faststart', '-an', outVideo]);
  } else {
    await runFfmpeg(['-y', '-i', srcPath, '-c:v', 'libx264', '-crf', '24', '-preset', 'medium',
                     '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outVideo]);
  }
  // Poster from 1s in
  await runFfmpeg(['-y', '-ss', '1', '-i', outVideo, '-frames:v', '1', '-q:v', '4',
                   '-vf', `scale='min(900,iw)':-2`, outPoster]);
  const dims = await ffprobeSize(outVideo);
  return {
    src: `/media/video/${base}.mp4`,
    poster: `/media/video/${base}.jpg`,
    type: 'video',
    width: dims.w,
    height: dims.h,
  };
}

// Deterministic shuffle (seedable)
function shuffle(arr, seed = 1337) {
  const a = [...arr];
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  await fs.mkdir(OUT_GALLERY, { recursive: true });
  await fs.mkdir(OUT_VIDEO, { recursive: true });

  const all = await fs.readdir(SRC_DIR);
  const items = [];

  let imgCount = 0, vidCount = 0, skipped = 0;

  for (const name of all) {
    const ext = path.extname(name).toLowerCase();
    const srcPath = path.join(SRC_DIR, name);
    try {
      if (IMG_EXT.has(ext)) {
        process.stdout.write(`img: ${name} ... `);
        const item = await processImage(srcPath, name);
        items.push(item);
        imgCount++;
        process.stdout.write('ok\n');
      } else if (VID_EXT.has(ext)) {
        console.log(`vid: ${name}`);
        const item = await processVideo(srcPath, name);
        if (item) { items.push(item); vidCount++; }
        else skipped++;
      }
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message.split('\n')[0]}`);
      skipped++;
    }
  }

  const shuffled = shuffle(items, 7331);
  const out = `// Auto-generated by scripts/process-media.mjs
export const galleryItems = ${JSON.stringify(shuffled, null, 2)};
`;
  await fs.writeFile(DATA_FILE, out);
  console.log(`\nDone. ${imgCount} images, ${vidCount} videos, ${skipped} skipped.`);
  console.log(`Wrote ${DATA_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
