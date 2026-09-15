// Holographic & Iridescent Cybernetic GLSL Shader
// Inspired by ThreeUI / Meng To holographic cards & HUD elements

export const holographicVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

uniform float uTime;
uniform float uWarp;

void main() {
  vUv = uv;
  vec3 transformed = position;

  // Subtle breathing ripple
  transformed += normal * (sin(uTime * 1.8 + position.y * 3.0) * uWarp * 0.05);

  vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
  vWorldPosition = worldPosition.xyz;

  vec4 mvPosition = viewMatrix * worldPosition;
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const holographicFragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uAccentColor;
uniform float uScanlineDensity;
uniform float uScanlineSpeed;
uniform float uFresnelPower;
uniform float uHoloIntensity;
uniform float uAlpha;

// Cosine based palette generators by Inigo Quilez
vec3 iridescence(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(1.0, 1.0, 1.0) * t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // 1. Fresnel edge glow
  float fresnel = 1.0 - max(0.0, dot(normal, viewDir));
  float fresnelGlow = pow(fresnel, uFresnelPower);

  // 2. Holographic horizontal scanlines
  float scanline = sin((vUv.y + uTime * uScanlineSpeed) * uScanlineDensity) * 0.5 + 0.5;
  scanline = pow(scanline, 2.8);

  // 3. Cybernetic micro-grid
  vec2 gridUv = fract(vUv * 24.0);
  float grid = step(0.92, gridUv.x) + step(0.92, gridUv.y);

  // 4. Iridescent chromatic dispersion based on viewing angle
  float angleFactor = dot(normal, viewDir);
  vec3 iridescentColor = iridescence(angleFactor * 1.6 + uTime * 0.12);

  // 5. Blended composition
  vec3 base = mix(uColorA, uColorB, vUv.y);
  vec3 color = base * 0.4;
  color += iridescentColor * fresnelGlow * 1.4;
  color += uAccentColor * (scanline * 0.45 + grid * 0.28);
  color += uAccentColor * pow(fresnel, 1.8) * 1.6;

  float alpha = clamp(uAlpha * (0.22 + fresnelGlow * 0.78 + scanline * 0.25), 0.0, 1.0);
  gl_FragColor = vec4(color * uHoloIntensity, alpha);
}
`;
