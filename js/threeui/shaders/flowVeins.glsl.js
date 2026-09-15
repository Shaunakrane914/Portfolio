// Energy Current, Flow Veins, and Laser Conduit GLSL Shaders
// Inspired by ThreeUI / Meng To cybernetic data pathways & energy grids

export const veinVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const veinFragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uPulseColor;
uniform float uSpeed;
uniform float uFrequency;
uniform float uPulseLength;
uniform float uIntensity;

void main() {
  // Repeating traveling energy packets
  float travel = fract(vUv.x * uFrequency - uTime * uSpeed);
  float pulse = smoothstep(0.0, 0.1, travel) * (1.0 - smoothstep(0.1, uPulseLength, travel));
  pulse = pow(pulse, 1.8);

  // Core laser brightness with soft edge falloff
  float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
  float core = pow(edge, 3.5);

  vec3 color = mix(uBaseColor * 0.3, uPulseColor * uIntensity, pulse);
  color += uPulseColor * core * 1.5;

  float alpha = clamp(0.18 + pulse * 0.82 + core * 0.4, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

export const voronoiDeckVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
uniform float uTime;

void main() {
  vUv = uv;
  vec3 pos = position;
  // Subtle surface breathing
  pos.z += sin(pos.x * 2.0 + uTime * 1.2) * 0.04;
  vPosition = pos;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const voronoiDeckFragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uGlowColor;

// 2D Hash function
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// 2D Voronoi Cellular Noise
float voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float m_dist = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.5 * sin(uTime * 0.8 + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      m_dist = min(m_dist, d);
    }
  }
  return sqrt(m_dist);
}

void main() {
  vec2 uv = vUv * 6.0;
  float d = voronoi(uv);

  // Glowing borders of cellular microgrid cells
  float border = smoothstep(0.05, 0.28, d);
  float edgeGlow = 1.0 - smoothstep(0.0, 0.12, abs(d - 0.2));

  vec3 color = mix(uColorA, uColorB, border);
  color += uGlowColor * edgeGlow * 1.8;

  // Pulse rings expanding outward
  float radius = length(vUv - vec2(0.5));
  float pulseRing = sin(radius * 18.0 - uTime * 2.4);
  pulseRing = smoothstep(0.7, 1.0, pulseRing) * smoothstep(0.5, 0.0, radius);
  color += uGlowColor * pulseRing * 1.4;

  gl_FragColor = vec4(color, 0.92);
}
`;
