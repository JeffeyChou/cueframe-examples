import { glsl, lib } from '@cueframe/gfx'

// Domain-warped fbm gas with a star field; palette blends cold blue → amber by `warm`.
export const NEBULA = glsl`${lib.fbm}
uniform float amt, warm, zoom, glow;
float stars(vec2 px, float cell, float density, float seed) {
  vec2 c = floor(px / cell);
  vec2 h = hash22(c + seed);
  if (h.x > density) return 0.0;
  vec2 o = (c + 0.2 + 0.6 * hash22(c + 3.1 + seed)) * cell;
  float r = length(px - o);
  float tw = 0.7 + 0.3 * sin(t * (1.0 + 3.0 * h.y) + h.y * 50.0);
  return exp(-r * r * 1.2) * pow(h.y, 5.0) * 6.0 * tw;
}
void main() {
  vec2 q = (vUv - 0.5) * vec2(logical.x / logical.y, 1.0) / zoom;
  vec2 px = q * logical.y + logical * 0.5;
  float s = t * 0.02;
  vec2 w = vec2(fbm(q * 0.8 + vec2(0.0, s), 4), fbm(q * 0.8 + vec2(5.2, 1.3 - s), 4));
  float n = fbm(q * 1.5 + 0.7 * w + vec2(s, 0.0), 6);
  float r = length(q * vec2(0.6, 1.0) - vec2(0.0, 0.03));
  float halo = exp(-r * r * 2.2);
  float dens = pow(smoothstep(-0.1, 0.8, n + 0.25 * halo), 2.2) * (0.15 + 1.1 * halo);
  float dust = smoothstep(0.1, 0.6, fbm(q * 3.4 + 1.5 * w + 9.0, 5));
  dens *= 1.0 - 0.65 * dust;
  float fil = pow(1.0 - abs(fbm(q * 2.2 + 1.2 * w + 3.0, 5)), 8.0) * halo * dens * 1.5;
  vec3 deepC = vec3(0.0015, 0.003, 0.011), midC = vec3(0.011, 0.036, 0.115), hotC = vec3(0.16, 0.32, 0.7);
  vec3 deepW = vec3(0.008, 0.0035, 0.0012), midW = vec3(0.08, 0.03, 0.007), hotW = vec3(0.48, 0.23, 0.07);
  vec3 deep = mix(deepC, deepW, warm), mid = mix(midC, midW, warm), hot = mix(hotC, hotW, warm);
  vec3 c = deep * (0.5 + halo);
  c += mid * (dens * 1.1 + fil * 0.6);
  c += hot * (pow(dens, 3.0) * 0.2 + fil * 0.15);
  float rc = length((vUv - vec2(0.5, 0.519)) * vec2(logical.x / logical.y, 1.0));
  c += mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.6, 0.25), warm) * glow * (exp(-rc * rc * 18.0) * 0.6 + exp(-rc * rc * 4.0) * 0.15);
  float st = stars(px, 12.0, 0.06, 17.0) + 0.5 * stars(px * 0.7 + 40.0, 8.0, 0.05, 41.0);
  c += mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.85, 0.65), warm) * st * 0.6 * (1.0 - 0.6 * smoothstep(0.0, 0.3, dens));
  fragColor = vec4(c * amt, 1.0);
}`

// Anamorphic flare: long horizontal streak, warm core and a few ghosts along the line through centre.
export const FLARE = glsl`
uniform vec2 pos;
uniform float inten, warm;
void main() {
  vec2 px = vec2(gl_FragCoord.x / scale, logical.y - gl_FragCoord.y / scale);
  vec2 d = px - pos;
  float streak = exp(-abs(d.y) / 2.5) * exp(-abs(d.x) / 900.0) * 1.1 + exp(-abs(d.y) / 16.0) * exp(-abs(d.x) / 420.0) * 0.28;
  float core = exp(-dot(d, d) / 1800.0) * 2.2 + exp(-length(d) / 140.0) * 0.35;
  vec3 sc = mix(vec3(0.35, 0.6, 1.0), vec3(1.0, 0.62, 0.3), warm * 0.6);
  vec3 c = sc * streak + vec3(1.0, 0.82, 0.6) * core;
  vec2 ctr = logical * 0.5;
  for (int i = 0; i < 3; i++) {
    float k = i == 0 ? -0.45 : i == 1 ? -1.1 : 0.55;
    float rad = i == 0 ? 70.0 : i == 1 ? 130.0 : 40.0;
    vec2 g = ctr + (ctr - pos) * k;
    float dd = length(px - g);
    float ring = exp(-pow((dd - rad) / 6.0, 2.0)) * 0.25 + exp(-dd * dd / (rad * rad)) * 0.06;
    c += vec3(0.9, 0.6, 0.3) * ring;
  }
  fragColor = vec4(c * inten, 0.0);
}`

export const PARTICLE_VS = `
in vec2 aStart; in vec2 aFlake; in vec2 aTitle; in vec4 aSeed;
uniform float uT, uScale, uZoom, uRot, uRotB, uRot2, uIn0, uBurst, uOut0, uDim, uHeat;
uniform vec2 uLogical, uC;
out vec3 vCol;
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float sm(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float oc(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
float io(float x) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
vec2 qb(vec2 a, vec2 c, vec2 b, float k) { float u = 1.0 - k; return u * u * a + 2.0 * u * k * c + k * k * b; }
vec2 cb(vec2 a, vec2 b, vec2 c, vec2 d, float k) { float u = 1.0 - k; return u * u * u * a + 3.0 * u * u * k * b + 3.0 * u * k * k * c + k * k * k * d; }
void main() {
  float t = uT;
  vec3 ice = vec3(0.55, 0.78, 1.0), gold = vec3(1.0, 0.7, 0.32), pale = vec3(1.0, 0.88, 0.7);
  float base = 0.55 + 0.75 * aSeed.z * aSeed.z;
  // breathing shimmer along the arms
  float tw = 0.75 + 0.25 * sin(t * (2.0 + 3.0 * aSeed.w) + aSeed.x * 60.0);
  vec2 flake = uC + rot(aFlake, uRot);
  float k1 = (t - uIn0 - aSeed.x * 1.7) / 2.1;
  vec2 dv = flake - aStart;
  vec2 c1 = 0.5 * (aStart + flake) + vec2(-dv.y, dv.x) * (aSeed.y - 0.5) * 0.8;
  vec2 p = qb(aStart, c1, flake, io(k1));
  float a = sm(k1 * 4.0);
  vec3 col = ice;
  float fly = sm(k1 * 3.0) * (1.0 - sm((k1 - 0.75) * 4.0));
  float heat = base * tw * (1.0 + 1.4 * fly + 2.2 * exp(-pow((k1 - 1.0) * 5.0, 2.0)));
  if (t >= uBurst) {
    vec2 f0 = uC + rot(aFlake, uRotB);
    vec2 r0 = f0 - uC;
    vec2 dir = length(r0) > 1.0 ? normalize(r0) : vec2(cos(aSeed.y * 6.283), sin(aSeed.y * 6.283));
    float k2 = (t - uBurst - aSeed.w * 0.55) / 1.75;
    float side = aSeed.x > 0.5 ? 1.0 : -1.0;
    vec2 b1 = f0 + dir * (140.0 + 300.0 * aSeed.y) + vec2(-dir.y, dir.x) * side * 160.0;
    vec2 b2 = aTitle + vec2((aSeed.z - 0.5) * 300.0 + side * 120.0, -160.0 - 160.0 * aSeed.x);
    p = cb(f0, b1, b2, aTitle, oc(k2));
    a = 1.0;
    col = mix(mix(ice, pale, sm((t - uBurst) * 3.0)), gold, sm(k2 * 1.4));
    heat = base * tw * (1.0 + 3.0 * exp(-(t - uBurst) * 3.5)) * mix(1.0, uDim, sm((k2 - 0.85) * 6.0));
    heat *= 1.0 + 1.6 * exp(-pow((k2 - 1.0) * 6.0, 2.0));
  }
  if (t >= uOut0) {
    vec2 f2 = uC + rot(aFlake * 0.92, uRot2);
    float k3 = (t - uOut0 - aSeed.y * 0.75) / 1.05;
    vec2 c3 = 0.5 * (aTitle + f2) + vec2((aSeed.z - 0.5) * 640.0, -180.0 - 240.0 * aSeed.x);
    p = qb(aTitle, c3, f2, io(k3));
    col = mix(gold, pale, sm(k3));
    heat = base * tw * mix(uDim, 0.95, sm(k3 * 3.0)) * (1.0 + 0.9 * exp(-pow((k3 - 1.0) * 5.0, 2.0)));
  }
  p += vec2(sin(t * 1.3 + aSeed.x * 40.0), cos(t * 1.1 + aSeed.y * 30.0)) * 1.3;
  p = (p - uLogical * 0.5) * uZoom + uLogical * 0.5;
  vCol = col * heat * uHeat * a;
  gl_PointSize = (2.2 + 2.6 * aSeed.z * aSeed.z) * (1.0 + 0.5 * fly) * uScale * uZoom;
  gl_Position = vec4(p.x / uLogical.x * 2.0 - 1.0, 1.0 - p.y / uLogical.y * 2.0, 0.0, 1.0);
}`

export const PARTICLE_FS = `
in vec3 vCol; out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float g = exp(-dot(d, d) * 16.0);
  fragColor = vec4(vCol * g, 0.0);
}`
