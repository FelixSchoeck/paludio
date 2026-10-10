export const BPM = 120;
export const BEAT = 60 / BPM;      // 0,5 s
export const DURATION = 12;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, p) => a + (b - a) * p;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const E = {
  out3: (p) => 1 - Math.pow(1 - p, 3),
  out5: (p) => 1 - Math.pow(1 - p, 5),
  in3: (p) => p * p * p,
  io3: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  io5: (p) => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2),
  ioSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  smoother: (p) => p * p * p * (p * (p * 6 - 15) + 10),
  back: (p) => { const c = 1.4; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
};
