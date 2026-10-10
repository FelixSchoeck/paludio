// Soundtrack Hochkant-Reel: 128 BPM, D-Dur (Hm – G – D – A), vollständig synthetisch, offline gerendert.
// Schläge, Schnitte, Fingertipps und Zähler sind exakt an die Bildereignisse in vertical.js gekoppelt.
import * as Tone from 'tone';
import { B, DURATION, TAPS, CUTS } from './vertical.js';
import { wavBase64 } from './audio.js';

const at = (beats) => beats * B;
const BAR = 4;
const CHORDS = [
  ['B2', 'F#3', 'A3', 'D4'], ['G2', 'D3', 'F#3', 'B3'], ['D3', 'A3', 'C#4', 'F#4'], ['A2', 'E3', 'G3', 'C#4'],
];
const ROOTS = ['B1', 'G1', 'D2', 'A1'];
const ARP = [['B4', 'D5', 'F#5', 'A5'], ['G4', 'B4', 'D5', 'F#5'], ['D5', 'F#5', 'A5', 'C#6'], ['A4', 'C#5', 'E5', 'G5']];
const DROP = at(36);          // Schlussakzent / Logo
const STATEMENTS = [8, 18, 28].map(at);
const COUNTS = [[8, 10.5], [18, 20.5], [28, 30.5]].map(([a, b]) => [at(a) + 0.1, at(b)]);

export async function renderAudio() {
  const buffer = await Tone.Offline(async () => {
    const dest = Tone.getDestination();
    const fade = new Tone.Gain(1);
    fade.gain.setValueAtTime(1, DURATION - 1.2);
    fade.gain.linearRampToValueAtTime(0, DURATION);
    const bus = new Tone.Gain(0.85);
    bus.chain(new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.008, release: 0.15 }), new Tone.Limiter(-1), fade, dest);
    const verb = new Tone.Reverb({ decay: 3.2, preDelay: 0.015, wet: 1 });
    await verb.generate();
    const verbIn = new Tone.Gain(1);
    verbIn.chain(new Tone.Filter(350, 'highpass'), verb, bus);
    const send = (node, dry, wet) => { node.connect(new Tone.Gain(dry).connect(bus)); node.connect(new Tone.Gain(wet).connect(verbIn)); };

    // Pumpen (Sidechain-Effekt) für Fläche und Bass
    const kicks = [];
    for (let b = 0; b < 4; b++) kicks.push(at(b));                 // Aufhänger: Schlag pro Wort
    for (let b = 4; b < 34; b++) kicks.push(at(b));                // Groove
    const pump = (gain, depth = 0.3) => {
      gain.gain.setValueAtTime(1, 0);
      for (const k of kicks) { gain.gain.setValueAtTime(depth, k); gain.gain.linearRampToValueAtTime(1, k + B * 0.55); }
    };

    /* Fläche */
    const padF = new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 0.6 });
    padF.frequency.setValueAtTime(700, 0);
    padF.frequency.exponentialRampToValueAtTime(2600, at(32));
    padF.frequency.exponentialRampToValueAtTime(6000, DROP - 0.05);
    padF.frequency.setValueAtTime(1600, DROP);
    const padG = new Tone.Gain(1);
    pump(padG, 0.35);
    const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 30 }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.8, release: 1.2 }, volume: -25 });
    pad.chain(padF, padG);
    send(padG, 0.7, 0.45);
    for (let bar = 0; bar < 9; bar++) pad.triggerAttackRelease(CHORDS[bar % 4], at(BAR) - 0.02, at(bar * BAR), 0.8);
    pad.triggerAttackRelease(['D3', 'A3', 'C#4', 'E4', 'F#4', 'A4'], 2.2, DROP, 0.9);

    /* Bass: Grundton auf der Eins, pumpende Achtel dazwischen */
    const bassG = new Tone.Gain(1);
    pump(bassG, 0.4);
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', Q: 2 },
      filterEnvelope: { attack: 0.002, decay: 0.16, sustain: 0.2, baseFrequency: 110, octaves: 3 },
      envelope: { attack: 0.003, decay: 0.2, sustain: 0.5, release: 0.08 }, volume: -16,
    });
    bass.chain(bassG, bus);
    for (let b = 4; b < 34; b += 0.5) {
      const root = ROOTS[Math.floor(b / BAR) % 4];
      bass.triggerAttackRelease(root, B * 0.42, at(b), b % 1 === 0 ? 0.55 : 0.9);
    }

    /* Schlagzeug */
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.035, octaves: 6.5, envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.05 }, volume: -6 }).connect(bus);
    kicks.forEach((k, i) => kick.triggerAttackRelease('C1', 0.25, k, i < 4 ? 1 : 0.92));
    const clapF = new Tone.Filter({ type: 'bandpass', frequency: 1500, Q: 0.8 });
    const clap = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.16, sustain: 0 }, volume: -15 }).connect(clapF);
    send(clapF, 1, 0.35);
    for (let b = 5; b < 32; b += 2) { clap.triggerAttackRelease(0.12, at(b), 0.9); }
    // Wirbel vor dem Schluss: Achtel → Sechzehntel → Zweiunddreißigstel, lauter werdend
    const roll = [];
    for (let b = 32; b < 34; b += 0.5) roll.push(b);
    for (let b = 34; b < 35; b += 0.25) roll.push(b);
    for (let b = 35; b < 35.9; b += 0.125) roll.push(b);
    roll.forEach((b, i) => clap.triggerAttackRelease(0.06, at(b), 0.35 + 0.65 * (i / roll.length)));
    const hatF = new Tone.Filter(8500, 'highpass');
    const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: -27 }).connect(hatF);
    send(hatF, 1, 0.1);
    for (let b = 4; b < 34; b += 0.25) hat.triggerAttackRelease(0.02, at(b), [0.5, 0.25, 0.85, 0.3][Math.round(b * 4) % 4]);
    const ohat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 }, volume: -28 }).connect(hatF);
    for (let b = 8.5; b < 32; b += 1) ohat.triggerAttackRelease(0.15, at(b), 0.8);

    /* Arpeggio ab Takt 3 */
    const delay = new Tone.PingPongDelay({ delayTime: at(0.75), feedback: 0.3, wet: 0.25 });
    const pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.12 }, volume: -29 });
    const pluckF = new Tone.Filter(3200, 'lowpass');
    pluck.chain(pluckF, delay);
    send(delay, 1, 0.3);
    for (let b = 8; b < 34; b += 0.25) {
      const notes = ARP[Math.floor(b / BAR) % 4];
      const i = Math.round(b * 4);
      pluck.triggerAttackRelease(notes[[0, 2, 1, 3, 2, 0, 3, 1][i % 8]], 0.08, at(b), i % 4 === 0 ? 0.9 : 0.55);
    }

    /* Aufhänger: tiefer Schlag pro Wort */
    const sub = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.003, decay: 0.35, sustain: 0, release: 0.1 }, volume: -8 }).connect(bus);
    ['B1', 'B1', 'G1', 'A1'].forEach((n, i) => sub.triggerAttackRelease(n, 0.3, at(i), 1));

    /* Wische vor jedem Schnitt, Einschläge auf den Statement-Szenen */
    const swish = (t1, len, vol, pan) => {
      const n = new Tone.Noise('pink'), f = new Tone.Filter({ type: 'bandpass', frequency: 400, Q: 1.2 }), g = new Tone.Gain(0), p = new Tone.Panner(-pan);
      n.chain(f, g, p); send(p, 1, 0.3);
      f.frequency.setValueAtTime(400, t1 - len); f.frequency.exponentialRampToValueAtTime(7000, t1);
      g.gain.setValueAtTime(0.0001, t1 - len); g.gain.exponentialRampToValueAtTime(vol, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1 + 0.1);
      p.pan.setValueAtTime(-pan, t1 - len); p.pan.linearRampToValueAtTime(pan, t1 + 0.1);
      n.start(t1 - len).stop(t1 + 0.12);
    };
    CUTS.forEach((c, i) => c < DROP && swish(c, 0.32, 0.22, i % 2 ? 0.6 : -0.6));
    const boom = new Tone.MembraneSynth({ pitchDecay: 0.09, octaves: 3.5, envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.3 }, volume: -9 }).connect(bus);
    const burstF = new Tone.Filter(2200, 'lowpass');
    const burst = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -20 }).connect(burstF);
    send(burstF, 0.5, 1);
    STATEMENTS.forEach((t) => { boom.triggerAttackRelease('G0', 0.8, t, 0.8); burst.triggerAttackRelease(0.3, t, 0.8); });

    /* Fingertipps und Bestätigung */
    const tick = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.012, sustain: 0 }, volume: -13 });
    const tickF = new Tone.Filter(2400, 'highpass');
    tick.connect(tickF); send(tickF, 1, 0.1);
    const chime = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.01, modulationIndex: 3, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 }, volume: -17,
    });
    send(chime, 0.7, 0.6);
    const CHIMES = [['F#6', 'B6'], ['A5', 'D6'], ['D6', 'A6']];
    TAPS.forEach((t, i) => {
      tick.triggerAttackRelease(0.01, t, 1);
      CHIMES[i].forEach((n, j) => chime.triggerAttackRelease(n, 0.25, t + 0.04 + j * 0.08, 0.75));
    });

    /* Zähler: feine Klicks, die mit dem Ausrollen langsamer werden */
    const cnt = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.01, sustain: 0, release: 0.01 }, volume: -34 });
    const cntF = new Tone.Filter(2500, 'highpass');
    cnt.connect(cntF); send(cntF, 1, 0.1);
    for (const [a, b] of COUNTS) {
      let last = -1;
      for (let t = a; t < b; t += 1 / 240) {
        const v = Math.floor((1 - Math.pow(1 - (t - a) / (b - a), 5)) * 22);
        if (v !== last) { cnt.triggerAttackRelease('E7', 0.01, t, 0.8); last = v; }
      }
    }

    /* Riser in den Schluss, kurze Stille, großer Einschlag, Glocke zum Logo */
    {
      const n = new Tone.Noise('white'), f = new Tone.Filter({ type: 'highpass', frequency: 500, Q: 0.7 }), g = new Tone.Gain(0);
      n.chain(f, g); send(g, 1, 0.5);
      f.frequency.setValueAtTime(500, at(32)); f.frequency.exponentialRampToValueAtTime(10000, DROP - 0.04);
      g.gain.setValueAtTime(0.0001, at(32)); g.gain.exponentialRampToValueAtTime(0.25, DROP - 0.06); g.gain.linearRampToValueAtTime(0, DROP - 0.03);
      n.start(at(32)).stop(DROP - 0.02);
      const s = new Tone.Oscillator({ type: 'sine', frequency: 220, volume: -24 }), sg = new Tone.Gain(0);
      s.connect(sg); send(sg, 1, 0.5);
      s.frequency.setValueAtTime(220, at(33)); s.frequency.exponentialRampToValueAtTime(1760, DROP - 0.04);
      sg.gain.setValueAtTime(0, at(33)); sg.gain.linearRampToValueAtTime(1, DROP - 0.06); sg.gain.linearRampToValueAtTime(0, DROP - 0.03);
      s.start(at(33)).stop(DROP - 0.02);
    }
    boom.triggerAttackRelease('D1', 1.4, DROP, 1);
    burst.triggerAttackRelease(0.6, DROP, 1);
    const subD = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 1.8, sustain: 0, release: 0.4 }, volume: -9 }).connect(bus);
    subD.triggerAttackRelease('D2', 1.6, DROP, 1);
    const bell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01, modulationIndex: 8, envelope: { attack: 0.002, decay: 2.2, sustain: 0, release: 1.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 }, volume: -18,
    });
    send(bell, 0.6, 1);
    [[0.3, 'D6'], [0.38, 'A6'], [0.95, 'F#6'], [1.03, 'D7']].forEach(([d, n]) => bell.triggerAttackRelease(n, 0.4, DROP + d, 0.75));
  }, DURATION, 2, 48000);

  return wavBase64(buffer.get());
}
