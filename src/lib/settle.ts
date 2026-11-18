import * as THREE from "three";

/**
 * Apilado "físico": cada capa baja hasta apoyarse en lo que ya hay debajo,
 * usando mapas de alturas de la geometría real (no una altura fija por modelo).
 * Así la hamburguesa queda compacta, sin huecos entre ingredientes.
 */

const CELL = 0.004; // tamaño de celda (m)
const HALF = 0.09; // la rejilla cubre ±9 cm
const N = Math.ceil((HALF * 2) / CELL);
const MAX_POINTS = 6000;
/** Percentil de contacto: deja que un 12 % de puntos (bordes rizados) se hundan un poco. */
const CONTACT = 0.88;

export type Cloud = Float32Array; // x, y, z intercalados

export function cloudOf(scene: THREE.Object3D, scaleY = 1): Cloud {
  scene.updateMatrixWorld(true);
  const root = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const pts: number[] = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos) return;
    m.multiplyMatrices(root, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      pts.push(v.x, v.y * scaleY, v.z);
    }
  });
  const count = pts.length / 3;
  if (count <= MAX_POINTS) return new Float32Array(pts);
  const step = count / MAX_POINTS;
  const out = new Float32Array(MAX_POINTS * 3);
  for (let i = 0; i < MAX_POINTS; i++) {
    const j = Math.floor(i * step) * 3;
    out.set([pts[j], pts[j + 1], pts[j + 2]], i * 3);
  }
  return out;
}

function maps(cloud: Cloud, angle: number) {
  const top = new Float32Array(N * N).fill(-Infinity);
  const bottom = new Float32Array(N * N).fill(Infinity);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i < cloud.length; i += 3) {
    const x = cloud[i] * c + cloud[i + 2] * s;
    const z = -cloud[i] * s + cloud[i + 2] * c;
    const gx = Math.floor((x + HALF) / CELL);
    const gz = Math.floor((z + HALF) / CELL);
    if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
    const k = gz * N + gx;
    const y = cloud[i + 1];
    if (y > top[k]) top[k] = y;
    if (y < bottom[k]) bottom[k] = y;
  }
  return { top, bottom };
}

/** Devuelve la altura de cada capa (origen del modelo) para que repose sobre la anterior. */
export function settle(layers: { cloud: Cloud | null; angle: number; fallback: number; contact?: number }[]) {
  const pile = new Float32Array(N * N).fill(-Infinity);
  const ys: number[] = [];
  let prevTop = 0;
  layers.forEach((l, i) => {
    if (!l.cloud) {
      const y = prevTop;
      ys.push(y);
      prevTop = y + l.fallback;
      return;
    }
    const { top, bottom } = maps(l.cloud, l.angle);
    let y = 0;
    if (i > 0) {
      const d: number[] = [];
      for (let k = 0; k < pile.length; k++) {
        if (bottom[k] !== Infinity && pile[k] !== -Infinity) d.push(pile[k] - bottom[k]);
      }
      if (d.length) {
        d.sort((a, b) => a - b);
        y = d[Math.min(d.length - 1, Math.floor(d.length * (l.contact ?? CONTACT)))];
      } else y = prevTop;
      y = Math.max(y, ys[i - 1]);
    }
    ys.push(y);
    let hi = -Infinity;
    for (let k = 0; k < pile.length; k++) {
      if (top[k] === -Infinity) continue;
      const t = y + top[k];
      if (t > pile[k]) pile[k] = t;
      if (t > hi) hi = t;
    }
    prevTop = Math.max(prevTop, hi);
  });
  return ys;
}
