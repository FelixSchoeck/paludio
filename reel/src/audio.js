// Sounddesign: vollständig synthetisch mit Tone.js, offline gerendert (bit-genau, synchron zu den Bildern).
// 120 BPM, D-Dur. Ruhiges Musikbett; Klicks, Bestätigungstöne und Luftbewegungen liegen exakt auf den Bildereignissen.
import * as Tone from 'tone';
import { DURATION } from './timeline.js';

const B = 0.5; // ein Schlag
const CLICKS = [2.3, 3.8, 5.55, 7.4, 8.65];
const PAGE_CHANGES = [3.8, 7.4];
const CAMERA_MOVES = [0.9, 2.85, 4.1, 5.85, 6.65, 7.65, 8.85];
const END = 9.9; // Schlussakzent, Logo erscheint

export async function renderAudio() {
  const buffer = await Tone.Offline(async () => {
    const dest = Tone.getDestination();

    /* Summe: Bus → sanfter Kompressor → Limiter → Ausblenden */
    const fade = new Tone.Gain(1);
    fade.gain.setValueAtTime(1, 11.0);
    fade.gain.linearRampToValueAtTime(0, DURATION);
    const bus = new Tone.Gain(0.9);
    bus.chain(new Tone.Compressor({ threshold: -18, ratio: 2.2, attack: 0.015, release: 0.25 }), new Tone.Limiter(-1.2), fade, dest);

    const verb = new Tone.Reverb({ decay: 4.2, preDelay: 0.02, wet: 1 });
    await verb.generate();
    const verbIn = new Tone.Gain(1);
    verbIn.chain(new Tone.Filter(300, 'highpass'), verb, bus);
    const send = (node, dry, wet) => { node.connect(new Tone.Gain(dry).connect(bus)); node.connect(new Tone.Gain(wet).connect(verbIn)); };

    /* Fläche: warme, weiche Akkorde; Filter öffnet sich langsam */
    const padFilter = new Tone.Filter({ type: 'lowpass', frequency: 420, Q: 0.5 });
    padFilter.frequency.setValueAtTime(420, 0);
    padFilter.frequency.exponentialRampToValueAtTime(1900, END - 0.1);
    padFilter.frequency.setValueAtTime(1100, END);
    padFilter.frequency.exponentialRampToValueAtTime(2600, END + 0.8);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.7, decay: 0.6, sustain: 0.7, release: 2.0 }, volume: -27,
    }).connect(padFilter);
    send(padFilter, 0.7, 0.6);
    [[0, ['D3', 'A3', 'C#4', 'E4', 'F#4']], [2, ['B2', 'F#3', 'A3', 'D4', 'E4']], [4, ['G2', 'D3', 'F#3', 'A3', 'B3']], [6, ['A2', 'E3', 'G3', 'B3', 'D4']], [8, ['F#2', 'D3', 'A3', 'C#4', 'E4']]]
      .forEach(([t, c]) => pad.triggerAttackRelease(c, t === 8 ? END - 8 : 2.05, t, 0.8));
    pad.triggerAttackRelease(['D3', 'A3', 'C#4', 'E4', 'F#4', 'A4'], 1.3, END, 0.85);

    /* Bass und leiser Puls */
    const sub = new Tone.MonoSynth({
      oscillator: { type: 'triangle' }, filter: { type: 'lowpass', Q: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.3, baseFrequency: 90, octaves: 1.4 },
      envelope: { attack: 0.03, decay: 0.5, sustain: 0.45, release: 0.4 }, volume: -25,
    }).connect(bus);
    [[2, 'B1'], [3.25, 'B1'], [4, 'G1'], [5.25, 'G1'], [6, 'A1'], [7.0, 'A1'], [8, 'F#1'], [9.0, 'F#1']].forEach(([t, n]) => sub.triggerAttackRelease(n, 0.9, t, 0.85));
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 }, volume: -22 }).connect(bus);
    for (let t = 2; t < 9.5; t += 1) kick.triggerAttackRelease('D1', 0.25, t, 0.8);
    const hatF = new Tone.Filter(8000, 'highpass');
    const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 }, volume: -34 }).connect(hatF);
    send(hatF, 1, 0.15);
    for (let t = 2.5; t < 9.5; t += 1) hat.triggerAttackRelease(0.03, t, 0.8);

    /* Arpeggio: zurückhaltender Pluck mit Ping-Pong-Delay */
    const delay = new Tone.PingPongDelay({ delayTime: 0.375, feedback: 0.25, wet: 0.2 });
    const pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.22 }, volume: -26 }).connect(delay);
    send(delay, 1, 0.35);
    const arp = { 0: ['D5', 'A4', 'E5', 'F#5'], 2: ['B4', 'F#5', 'C#5', 'D5'], 4: ['G4', 'D5', 'A4', 'F#5'], 6: ['A4', 'E5', 'B4', 'D5'], 8: ['F#4', 'D5', 'A4', 'C#5'] };
    for (const [bar, notes] of Object.entries(arp)) {
      const t0 = Number(bar);
      let i = 0;
      for (let t = Math.max(t0, 1.0); t < t0 + 2 - 0.01 && t < 9.5; t += 0.25, i++) pluck.triggerAttackRelease(notes[i % 4], 0.1, t, i % 4 === 0 ? 0.85 : 0.5);
    }

    /* Luft: Fenster erscheint, Kamerafahrten, Seitenwechsel */
    const air = (t0, len, vol, f0, f1, from, to, type = 'bandpass') => {
      const n = new Tone.Noise('pink');
      const f = new Tone.Filter({ type, frequency: f0, Q: 0.9 });
      const g = new Tone.Gain(0);
      const p = new Tone.Panner(from);
      n.chain(f, g, p);
      send(p, 1, 0.45);
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + len);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + len * 0.6);
      g.gain.linearRampToValueAtTime(0, t0 + len);
      p.pan.setValueAtTime(from, t0);
      p.pan.linearRampToValueAtTime(to, t0 + len);
      n.start(t0).stop(t0 + len + 0.02);
    };
    air(0.0, 1.3, 0.2, 200, 2400, 0, 0);
    CAMERA_MOVES.forEach((t, i) => air(t - 0.05, 0.9, 0.05, 300, 1400, i % 2 ? 0.4 : -0.4, i % 2 ? -0.2 : 0.2, 'lowpass'));
    PAGE_CHANGES.forEach((t, i) => air(t - 0.12, 0.5, 0.13, 500, 5500, i ? 0.5 : -0.5, i ? -0.5 : 0.5));

    /* Klicks: kurzer, trockener Doppelimpuls */
    const tickF = new Tone.Filter(2600, 'highpass');
    const tick = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.012, sustain: 0 }, volume: -16 }).connect(tickF);
    send(tickF, 1, 0.12);
    const blip = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 }, volume: -22 });
    send(blip, 1, 0.1);
    CLICKS.forEach((t) => {
      tick.triggerAttackRelease(0.01, t, 1);
      tick.triggerAttackRelease(0.01, t + 0.065, 0.55);
      blip.triggerAttackRelease(1900, 0.02, t, 0.8);
    });

    /* Bestätigungstöne, wenn die App reagiert */
    const chime = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.01, modulationIndex: 3.2, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.003, decay: 0.8, sustain: 0, release: 1.0 }, modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }, volume: -19,
    });
    send(chime, 0.75, 0.7);
    [[2.36, 'A5'], [2.46, 'D6'], [5.62, 'F#5'], [5.72, 'B5'], [8.72, 'D6'], [8.82, 'F#6'], [8.92, 'A6']].forEach(([t, n]) => chime.triggerAttackRelease(n, 0.3, t, 0.75));

    /* Beschriftungen: leiser Mallet-Ton */
    const mallet = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01, modulationIndex: 2.2, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 }, volume: -25,
    });
    send(mallet, 0.7, 0.8);
    [[0.6, 'D5'], [4.0, 'B4'], [7.7, 'A4']].forEach(([t, n]) => mallet.triggerAttackRelease(n, 0.2, t, 0.7));

    /* Riser in den Abspann, kurzer Moment Stille, dann Schlussakzent */
    {
      const n = new Tone.Noise('white');
      const f = new Tone.Filter({ type: 'highpass', frequency: 600, Q: 0.7 });
      const g = new Tone.Gain(0);
      n.chain(f, g);
      send(g, 1, 0.5);
      f.frequency.setValueAtTime(600, END - 0.9);
      f.frequency.exponentialRampToValueAtTime(9000, END - 0.04);
      g.gain.setValueAtTime(0.0001, END - 0.9);
      g.gain.exponentialRampToValueAtTime(0.14, END - 0.07);
      g.gain.linearRampToValueAtTime(0, END - 0.035);
      n.start(END - 0.9).stop(END - 0.03);
    }
    {
      const boom = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 3.5, envelope: { attack: 0.001, decay: 1.3, sustain: 0, release: 0.4 }, volume: -9 }).connect(bus);
      boom.triggerAttackRelease('D1', 1.1, END, 0.75);
      const nf = new Tone.Filter(1400, 'lowpass');
      const burst = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.5, sustain: 0 }, volume: -22 }).connect(nf);
      send(nf, 0.5, 1);
      burst.triggerAttackRelease(0.45, END, 1);
      const bell = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, modulationIndex: 8, envelope: { attack: 0.002, decay: 2.2, sustain: 0, release: 1.8 },
        modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 }, volume: -21,
      });
      send(bell, 0.6, 1);
      [[10.4, 'D6'], [10.5, 'A6'], [11.0, 'F#6'], [11.1, 'D7']].forEach(([t, n]) => bell.triggerAttackRelease(n, 0.4, t, 0.7));
    }
  }, DURATION, 2, 48000);

  return wavBase64(buffer.get());
}

export function wavBase64(ab) {
  const ch = ab.numberOfChannels, sr = ab.sampleRate, n = ab.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => ab.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { data.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 32767, true); o += 2; }
  const bytes = new Uint8Array(data.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
