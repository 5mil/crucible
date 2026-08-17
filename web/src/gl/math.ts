/** Minimal mat4 / vec helpers for the WebGL host (column-major). */

export type Mat4 = Float32Array; // 16 floats
export type Vec3 = [number, number, number];

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mat4Perspective(fovyRad: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

export function mat4LookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const zx = eye[0] - center[0];
  const zy = eye[1] - center[1];
  const zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  const z0 = zx / len;
  const z1 = zy / len;
  const z2 = zz / len;

  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  len = Math.hypot(x0, x1, x2) || 1;
  x0 /= len;
  x1 /= len;
  x2 /= len;

  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  const m = new Float32Array(16);
  m[0] = x0;
  m[1] = y0;
  m[2] = z0;
  m[3] = 0;
  m[4] = x1;
  m[5] = y1;
  m[6] = z1;
  m[7] = 0;
  m[8] = x2;
  m[9] = y2;
  m[10] = z2;
  m[11] = 0;
  m[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  m[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  m[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  m[15] = 1;
  return m;
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export function mat4Translate(m: Mat4, t: Vec3): Mat4 {
  const out = m.slice() as Mat4;
  out[12] = m[0] * t[0] + m[4] * t[1] + m[8] * t[2] + m[12];
  out[13] = m[1] * t[0] + m[5] * t[1] + m[9] * t[2] + m[13];
  out[14] = m[2] * t[0] + m[6] * t[1] + m[10] * t[2] + m[14];
  out[15] = m[3] * t[0] + m[7] * t[1] + m[11] * t[2] + m[15];
  return out;
}

export function mat4Scale(m: Mat4, s: Vec3): Mat4 {
  const out = m.slice() as Mat4;
  out[0] *= s[0];
  out[1] *= s[0];
  out[2] *= s[0];
  out[3] *= s[0];
  out[4] *= s[1];
  out[5] *= s[1];
  out[6] *= s[1];
  out[7] *= s[1];
  out[8] *= s[2];
  out[9] *= s[2];
  out[10] *= s[2];
  out[11] *= s[2];
  return out;
}

/** Yaw (Y), then pitch (X), then roll (Z) — matches vehicle body lean. */
export function mat4FromYawPitchRoll(yaw: number, pitch: number, roll: number): Mat4 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  const m = new Float32Array(16);
  m[0] = cy * cr + sy * sp * sr;
  m[1] = cp * sr;
  m[2] = -sy * cr + cy * sp * sr;
  m[3] = 0;
  m[4] = -cy * sr + sy * sp * cr;
  m[5] = cp * cr;
  m[6] = sy * sr + cy * sp * cr;
  m[7] = 0;
  m[8] = sy * cp;
  m[9] = -sp;
  m[10] = cy * cp;
  m[11] = 0;
  m[12] = 0;
  m[13] = 0;
  m[14] = 0;
  m[15] = 1;
  return m;
}
