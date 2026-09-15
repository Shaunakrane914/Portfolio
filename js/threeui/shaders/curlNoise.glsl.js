// GLSL Curl Noise & 3D Simplex Noise Shader Utilities
// Inspired by ThreeUI / Meng To spatial particle systems

export const noiseGLSL = /* glsl */ `
// Simplex 3D noise by Ian McEwan, Stefan Gustavson
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v   - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix contributions
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  float n1 = snoise(vec3(p.x, p.y + e, p.z));
  float n2 = snoise(vec3(p.x, p.y - e, p.z));
  float n3 = snoise(vec3(p.x, p.y, p.z + e));
  float n4 = snoise(vec3(p.x, p.y, p.z - e));
  float n5 = snoise(vec3(p.x + e, p.y, p.z));
  float n6 = snoise(vec3(p.x - e, p.y, p.z));

  float x = (n1 - n2) - (n3 - n4);
  float y = (n3 - n4) - (n5 - n6);
  float z = (n5 - n6) - (n1 - n2);

  return normalize(vec3(x, y, z) / (2.0 * e));
}
`;

export const particleVertexShader = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uPointer;
uniform float uPointerRadius;
uniform float uPointerForce;
uniform float uNoiseScale;
uniform float uPointSize;

attribute float aPhase;
attribute float aSize;
attribute vec3 aBaseColor;

varying vec3 vColor;
varying float vAlpha;

${noiseGLSL}

void main() {
  vec3 pos = position;
  float t = uTime * uSpeed + aPhase;

  // Curl noise displacement
  vec3 curl = curlNoise(pos * uNoiseScale + vec3(0.0, t * 0.25, 0.0));
  pos += curl * (0.35 + 0.15 * sin(t + aPhase * 6.28));

  // Orbital vortex rotation around Y
  float angle = t * 0.18 + length(pos.xz) * 0.08;
  float cosA = cos(angle);
  float sinA = sin(angle);
  pos.xz = mat2(cosA, -sinA, sinA, cosA) * pos.xz;

  // Mouse interaction: gravitational well & vortex
  vec3 toPointer = pos - uPointer;
  float dist = length(toPointer);
  if (dist < uPointerRadius) {
    float force = (1.0 - dist / uPointerRadius) * uPointerForce;
    vec3 tangent = cross(normalize(toPointer), vec3(0.0, 1.0, 0.0));
    pos += tangent * force * 1.8;
    pos -= normalize(toPointer) * force * 0.6;
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Attenuate point size by camera depth to delicate stardust scale
  gl_PointSize = clamp((uPointSize * aSize * (1.0 + 0.3 * sin(t * 2.0))) * (24.0 / -mvPosition.z), 1.0, 12.0);

  // Dynamic color modulation
  vColor = aBaseColor + vec3(0.12 * sin(t + pos.y), 0.08 * cos(t + pos.x), 0.15 * sin(t));
  vAlpha = smoothstep(28.0, 4.0, -mvPosition.z);
}
`;

export const particleFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  // Soft circular glow point with bright core
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  float core = smoothstep(0.12, 0.0, dist);
  float halo = exp(-dist * 5.2);
  float intensity = core * 0.8 + halo * 0.6;

  gl_FragColor = vec4(vColor * 0.95, vAlpha * intensity * 0.55);
}
`;
