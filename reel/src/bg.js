// Abstrakter Hintergrund (WebGL): ruhige helle Fläche, weiche Farbschleier, feine Höhenlinien wie auf einer Moorkarte
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uLines;
out vec4 o;
vec3 mod289(vec3 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(vec2 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec3 permute(vec3 x){ return mod289(((x * 34.) + 1.) * x); }
float snoise(vec2 v){
  const vec4 C = vec4(.211324865405187, .366025403784439, -.577350269189626, .024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
  vec3 m = max(.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.); m = m * m; m = m * m;
  vec3 x = 2. * fract(p * C.www) - 1.; vec3 h = abs(x) - .5; vec3 ox = floor(x + .5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - .85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130. * dot(m, g);
}
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * snoise(p); p = p * 2.02 + 11.3; a *= .5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.y;
  vec3 col = vec3(.952, .956, .937);
  float a = fbm(uv * 1.1 + vec2(uT * .035, -uT * .02));
  float b = fbm(uv * .9 + vec2(7.1, 3.3) - vec2(uT * .02, uT * .03));
  col = mix(col, vec3(.875, .925, .885), smoothstep(-.1, .7, a) * .55);
  col = mix(col, vec3(.880, .915, .935), smoothstep(0., .8, b) * .45);
  // Höhenlinien, 1 px breit, sehr zurückhaltend
  float h = fbm(uv * 1.5 + vec2(uT * .012, uT * .008)) * 9.;
  float d = abs(fract(h) - .5) / fwidth(h);
  float line = 1. - clamp(d - .35, 0., 1.);
  col = mix(col, vec3(.18, .41, .23), line * uLines);
  // leichte Vignette
  vec2 c = gl_FragCoord.xy / uRes - .5;
  col *= 1. - dot(c, c) * .12;
  o = vec4(col, 1.);
}`;

export function createBackground(canvas, pixelRatio) {
  canvas.width = 1920 * pixelRatio;
  canvas.height = 1080 * pixelRatio;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uT = gl.getUniformLocation(prog, 'uT'), uLines = gl.getUniformLocation(prog, 'uLines');
  gl.viewport(0, 0, canvas.width, canvas.height);
  return (t, lines) => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform1f(uLines, lines);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
