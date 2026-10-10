// Rendert den Showreel auf der GPU (Headless Chrome, WebGL über D3D11) und kodiert ihn mit Ton.
//   node render.mjs                  → out/paludio-showreel.mp4   (1920×1080, 60 fps, AAC-Ton)
//   node render.mjs --4k             → out/paludio-showreel-4k.mp4 (3840×2160, H.264)
//   node render.mjs --stills 1,3.5   → out/stills/t-1.png …
//   node render.mjs --audio          → nur out/sound.wav
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = 60, DURATION = 12;
const SUB = Number(process.env.SUB ?? 3);           // Teilbilder je Bild für Bewegungsunschärfe
const args = process.argv.slice(2);
const K4 = args.includes('--4k');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
mkdirSync(here('./out/'), { recursive: true });

const server = await createServer({ root: here('./'), server: { port: 5181, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 600000,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('Seitenfehler:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('Konsole:', m.text()));
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: K4 ? 2 : 1 });
await page.goto(`${url}?ss=2`, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.ready);

async function done() { await browser.close(); await server.close(); }

const stillsAt = args.indexOf('--stills');
if (stillsAt >= 0) {
  mkdirSync(here('./out/stills/'), { recursive: true });
  for (const t of args[stillsAt + 1].split(',').map(Number)) {
    await page.evaluate((t) => window.renderFrame(t), t);
    await page.screenshot({ path: here(`./out/stills/t-${t}.png`) });
    console.log('Standbild', t);
  }
  await done();
  process.exit(0);
}

// Ton
const t0 = Date.now();
const wav = await page.evaluate(() => window.renderAudio());
writeFileSync(here('./out/sound-raw.wav'), Buffer.from(wav, 'base64'));
// Lautheit auf −16 LUFS / −1,5 dBTP normalisieren (zwei Durchgänge, linear – keine Dynamikverluste)
const target = 'I=-16:TP=-1.5:LRA=11';
const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', here('./out/sound-raw.wav'), '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(meas.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', here('./out/sound-raw.wav'), '-af',
  `loudnorm=${target}:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset},aresample=48000`,
  '-c:a', 'pcm_s24le', here('./out/sound.wav')]);
console.log(`Ton fertig (${((Date.now() - t0) / 1000).toFixed(1)} s, ${m.input_i} → −16 LUFS)`);
if (args.includes('--audio')) { await done(); process.exit(0); }

// Bild
const out = here(K4 ? './out/paludio-showreel-4k.mp4' : './out/paludio-showreel.mp4');
const weights = Array(SUB).fill(1).join(' ');
const video = K4
  // x264 statt NVENC: NVENC dieser ffmpeg-Version braucht NVIDIA-Treiber ≥ 610
  ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '5.2']
  : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high'];
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
  '-i', here('./out/sound.wav'),
  '-vf', `tmix=frames=${SUB}:weights='${weights}',select='not(mod(n+1\\,${SUB}))',setpts=N/${FPS}/TB`,
  '-r', String(FPS), ...video,
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = FPS * DURATION * SUB;
for (let i = 0; i < total; i++) {
  // Teilbilder über einen 180°-Verschluss verteilt, Zähler und Text auf dem Bildzeitpunkt
  const f = Math.floor(i / SUB), k = i % SUB;
  const t = (f + (k / Math.max(1, SUB - 1) - 0.5) * 0.5) / FPS;
  await page.evaluate((t, tf) => window.renderFrame(t, tf), Math.max(0, t), f / FPS);
  const buf = await page.screenshot({ type: 'png', optimizeForSpeed: true });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % (SUB * 60) === 0) console.log(`Bild ${f}/${FPS * DURATION} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await done();
console.log(`fertig: ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
