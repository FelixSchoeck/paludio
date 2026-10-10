import { createBackground } from './bg.js';
import { initReel, renderReel } from './reel.js';
import { DURATION, seg, E } from './timeline.js';

const q = new URLSearchParams(location.search);
const drawBg = createBackground(document.getElementById('bg'), Number(q.get('ss') ?? 1));

function renderFrame(t) {
  drawBg(t, 0.05 + 0.05 * E.ioSine(seg(t, 9.9, 11.0)));
  renderReel(t);
}

window.ready = (async () => {
  await initReel();
  await Promise.all([document.fonts.load('600 30px Geist'), document.fonts.load('500 13px Geist')]);
  await document.fonts.ready;
  renderFrame(0);
  return true;
})();
window.renderFrame = renderFrame;
window.renderAudio = async () => (await import('./audio.js')).renderAudio();

// Vorschau: ?play (Echtzeit-Schleife) oder ?t=3.4 (Standbild)
window.ready.then(() => {
  if (q.has('t')) renderFrame(Number(q.get('t')));
  else if (q.has('play')) {
    const t0 = performance.now();
    const loop = () => { renderFrame(((performance.now() - t0) / 1000) % (DURATION + 0.5)); requestAnimationFrame(loop); };
    loop();
  }
});
