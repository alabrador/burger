"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Cloud } from "@/lib/settle";

/**
 * Vapor realista: decenas de bocanadas suaves que nacen en la superficie
 * del pan de arriba, suben despacio, se abren, giran y se disipan.
 * Cada partícula tiene su propio ciclo, así que el humo nunca se repite.
 */

const COUNT = 70;
const LIFE = 3.6; // segundos que vive cada bocanada
const RISE = 0.05; // metros que sube como máximo

const vertex = /* glsl */ `
attribute vec3 aSpawn;
attribute float aSeed;
uniform float uTime;
uniform float uScale;
varying float vAlpha;
varying float vLife;
varying float vSeed;
varying float vRot;

void main() {
  float r1 = fract(aSeed * 7.31), r2 = fract(aSeed * 3.17), r3 = fract(aSeed * 5.73), r4 = fract(aSeed * 9.13);
  float life = fract(uTime / (LIFE * (0.8 + 0.4 * r1)) + aSeed);
  vec3 p = aSpawn;
  // Sube frenando (el vapor pierde fuerza) y se mece con corrientes suaves.
  float rise = (1.0 - pow(1.0 - life, 1.6)) * RISE * (0.6 + 0.7 * r2);
  float ph = aSeed * 40.0;
  p.y += rise;
  p.x += (sin(uTime * 0.8 + ph + life * 3.5) * 0.007 + (r3 - 0.5) * 0.025) * life;
  p.z += (cos(uTime * 0.6 + ph * 1.3 + life * 2.7) * 0.007 + (r4 - 0.5) * 0.025) * life;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = mix(0.008, 0.04, sqrt(life)) * (0.75 + 0.5 * r3);
  gl_PointSize = size * uScale / -mv.z;
  vAlpha = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.3, 1.0, life));
  vLife = life;
  vSeed = aSeed;
  vRot = aSeed * 6.2831 + life * (r4 - 0.5) * 2.5;
}`.replace("LIFE", LIFE.toFixed(2)).replace("RISE", RISE.toFixed(3));

const fragment = /* glsl */ `
uniform float uOpacity;
varying float vAlpha;
varying float vLife;
varying float vSeed;
varying float vRot;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 7.7; a *= 0.5; }
  return v;
}

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vRot), sn = sin(vRot);
  c = mat2(cs, -sn, sn, cs) * c;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  // Bocanada con bordes deshilachados que se deforman mientras vive.
  float n = fbm(c * 4.5 + vSeed * 17.0 + vec2(0.0, vLife * 1.5));
  float detail = fbm(c * 9.0 - vSeed * 5.0 + vec2(vLife, -vLife * 2.0));
  float puff = 1.0 - smoothstep(0.15, 1.0, r + (n - 0.5) * 0.8);
  float wisp = smoothstep(0.35, 0.85, n * 0.7 + detail * 0.5);
  float a = puff * wisp * vAlpha * uOpacity;
  if (a < 0.002) discard;
  vec3 col = mix(vec3(0.93, 0.91, 0.88), vec3(1.0, 0.99, 0.97), n);
  gl_FragColor = vec4(col, a);
}`;

/** Elige puntos de la cara superior del pan como origen del vapor. */
function spawnPoints(cloud: Cloud) {
  let maxY = -Infinity;
  for (let i = 1; i < cloud.length; i += 3) maxY = Math.max(maxY, cloud[i]);
  const top: number[] = [];
  for (let i = 0; i < cloud.length; i += 3) {
    // Solo la cúpula: cerca de la cima y no en los laterales.
    if (cloud[i + 1] > maxY - 0.016 && Math.hypot(cloud[i], cloud[i + 2]) < 0.045) top.push(cloud[i], cloud[i + 1], cloud[i + 2]);
  }
  return top.length ? top : [0, maxY, 0];
}

export default function Steam({ y, cloud }: { y: number; cloud: Cloud }) {
  const ref = useRef<THREE.Group>(null);
  const { gl, camera } = useThree();

  const { geometry, material } = useMemo(() => {
    const src = spawnPoints(cloud);
    const n = src.length / 3;
    const spawn = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const s = (i + 0.5) / COUNT;
      const j = Math.floor(((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * n);
      spawn[i * 3] = src[j * 3];
      spawn[i * 3 + 1] = src[j * 3 + 1] + 0.001;
      spawn[i * 3 + 2] = src[j * 3 + 2];
      seed[i] = (s * 0.618034 * COUNT) % 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(spawn.slice(), 3));
    geometry.setAttribute("aSpawn", new THREE.BufferAttribute(spawn, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.03, 0), 0.12);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uOpacity: { value: 0.22 } },
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, [cloud]);

  const size = useMemo(() => new THREE.Vector2(), []);
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
    gl.getDrawingBufferSize(size);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 30;
    material.uniforms.uScale.value = size.y / (2 * Math.tan((fov * Math.PI) / 360));
    const g = ref.current;
    if (g) g.position.y += (y - g.position.y) * Math.min(1, dt * 6);
  });

  return (
    <group ref={ref} position-y={y}>
      <points geometry={geometry} material={material} renderOrder={10} frustumCulled={false} />
    </group>
  );
}
