/**
 * WebGL2 host renderer — Empire & Kin procedural fidelity for the browser.
 * Articulated characters, multi-part vehicles, windowed buildings, street props.
 */

import {
  mat4Identity,
  mat4Perspective,
  mat4LookAt,
  mat4Multiply,
  mat4Translate,
  mat4Scale,
  mat4FromYawPitchRoll,
  type Mat4,
  type Vec3,
} from "./math";
import type { CrucibleModule } from "../wasm";

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorld;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform vec3 uEye;
uniform float uAmbient;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  float amb = uAmbient;
  vec3 view = normalize(uEye - vWorld);
  vec3 h = normalize(normalize(uLightDir) + view);
  float spec = pow(max(dot(n, h), 0.0), 28.0) * 0.18;
  vec3 col = uColor * (amb + ndl * 0.72) + vec3(spec);
  fragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Link: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function createBoxMesh(gl: WebGL2RenderingContext) {
  const faces: { n: Vec3; verts: Vec3[] }[] = [
    { n: [0, 0, 1], verts: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { n: [0, 0, -1], verts: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { n: [0, 1, 0], verts: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { n: [0, -1, 0], verts: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
    { n: [1, 0, 0], verts: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { n: [-1, 0, 0], verts: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
  ];
  const data: number[] = [];
  const indices: number[] = [];
  let vi = 0;
  for (const f of faces) {
    for (const v of f.verts) data.push(v[0], v[1], v[2], f.n[0], f.n[1], f.n[2]);
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bindVertexArray(null);
  return { vao, indexCount: indices.length };
}

const MARKER_COLORS: Vec3[] = [
  [0.86, 0.7, 0.16],
  [0.31, 0.7, 0.39],
  [0.39, 0.55, 0.86],
  [0.7, 0.39, 0.78],
  [0.95, 0.55, 0.2],
];

const VEH_PALETTE: Vec3[] = [
  [0.72, 0.16, 0.14],
  [0.85, 0.75, 0.2],
  [0.2, 0.35, 0.55],
  [0.25, 0.25, 0.28],
];

export class GlRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private box: { vao: WebGLVertexArrayObject; indexCount: number };
  private uMVP: WebGLUniformLocation;
  private uModel: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uLightDir: WebGLUniformLocation;
  private uEye: WebGLUniformLocation;
  private uAmbient: WebGLUniformLocation;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, depth: true });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    this.program = link(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.box = createBoxMesh(gl);
    this.uMVP = gl.getUniformLocation(this.program, "uMVP")!;
    this.uModel = gl.getUniformLocation(this.program, "uModel")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;
    this.uLightDir = gl.getUniformLocation(this.program, "uLightDir")!;
    this.uEye = gl.getUniformLocation(this.program, "uEye")!;
    this.uAmbient = gl.getUniformLocation(this.program, "uAmbient")!;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  private drawBox(viewProj: Mat4, model: Mat4, color: Vec3, eye: Vec3, ambient = 0.28) {
    const gl = this.gl;
    const mvp = mat4Multiply(viewProj, model);
    gl.uniformMatrix4fv(this.uMVP, false, mvp);
    gl.uniformMatrix4fv(this.uModel, false, model);
    gl.uniform3fv(this.uColor, color);
    gl.uniform3fv(this.uEye, eye);
    gl.uniform1f(this.uAmbient, ambient);
    gl.bindVertexArray(this.box.vao);
    gl.drawElements(gl.TRIANGLES, this.box.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  private boxAt(
    viewProj: Mat4,
    eye: Vec3,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Vec3,
    yaw = 0,
    pitch = 0,
    roll = 0,
    ambient = 0.28
  ) {
    let m = mat4Identity();
    m = mat4Translate(m, [x, y, z]);
    if (yaw || pitch || roll) m = mat4Multiply(m, mat4FromYawPitchRoll(yaw, pitch, roll));
    m = mat4Scale(m, [sx, sy, sz]);
    this.drawBox(viewProj, m, color, eye, ambient);
  }

  private drawCharacter(
    viewProj: Mat4,
    eye: Vec3,
    x: number,
    z: number,
    yaw: number,
    suit: Vec3,
    skin: Vec3,
    scale = 1,
    plumbob = false
  ) {
    const s = scale;
    // legs
    this.boxAt(viewProj, eye, x - 0.12 * s, 0.35 * s, z, 0.18 * s, 0.7 * s, 0.18 * s, [suit[0] * 0.7, suit[1] * 0.7, suit[2] * 0.7], yaw);
    this.boxAt(viewProj, eye, x + 0.12 * s, 0.35 * s, z, 0.18 * s, 0.7 * s, 0.18 * s, [suit[0] * 0.7, suit[1] * 0.7, suit[2] * 0.7], yaw);
    // torso
    this.boxAt(viewProj, eye, x, 1.05 * s, z, 0.42 * s, 0.7 * s, 0.28 * s, suit, yaw);
    // arms
    this.boxAt(viewProj, eye, x - 0.32 * s, 1.0 * s, z, 0.14 * s, 0.55 * s, 0.14 * s, suit, yaw);
    this.boxAt(viewProj, eye, x + 0.32 * s, 1.0 * s, z, 0.14 * s, 0.55 * s, 0.14 * s, suit, yaw);
    // head
    this.boxAt(viewProj, eye, x, 1.55 * s, z, 0.28 * s, 0.28 * s, 0.28 * s, skin, yaw);
    // hat brim
    this.boxAt(viewProj, eye, x, 1.72 * s, z, 0.36 * s, 0.08 * s, 0.36 * s, [0.15, 0.12, 0.1], yaw);
    if (plumbob) {
      this.boxAt(viewProj, eye, x, 2.15 * s, z, 0.22 * s, 0.35 * s, 0.22 * s, [0.25, 0.95, 0.35], 0, 0, 0, 0.55);
      this.boxAt(viewProj, eye, x, 2.4 * s, z, 0.12 * s, 0.12 * s, 0.12 * s, [0.9, 1, 0.9], 0, 0, 0, 0.7);
    }
  }

  private drawVehicle(
    viewProj: Mat4,
    eye: Vec3,
    x: number,
    z: number,
    yaw: number,
    pitch: number,
    roll: number,
    color: Vec3,
    vtype: number
  ) {
    // body
    const bodyH = vtype === 2 ? 1.1 : vtype === 3 ? 0.55 : 0.75;
    const bodyL = vtype === 2 ? 4.4 : vtype === 3 ? 2.2 : 3.6;
    const bodyW = vtype === 2 ? 2.2 : vtype === 3 ? 0.7 : 1.85;
    this.boxAt(viewProj, eye, x, bodyH * 0.55, z, bodyW, bodyH, bodyL, color, yaw, pitch, roll);
    // cabin / roof
    if (vtype !== 3) {
      this.boxAt(viewProj, eye, x, bodyH * 0.55 + 0.55, z - 0.15, bodyW * 0.85, 0.55, bodyL * 0.45, [color[0] * 0.85, color[1] * 0.85, color[2] * 0.85], yaw, pitch, roll);
      // windows (darker)
      this.boxAt(viewProj, eye, x, bodyH * 0.55 + 0.55, z - 0.15, bodyW * 0.88, 0.42, bodyL * 0.42, [0.15, 0.2, 0.25], yaw, pitch, roll, 0.45);
    }
    // wheels
    const wx = bodyW * 0.55;
    const wz = bodyL * 0.32;
    const wh = 0.32;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.boxAt(viewProj, eye, x + sx * wx * Math.cos(yaw) - sz * wz * Math.sin(yaw), wh, z + sx * wx * Math.sin(yaw) + sz * wz * Math.cos(yaw), 0.28, 0.55, 0.55, [0.12, 0.12, 0.12], yaw);
      }
    }
  }

  private drawBuilding(
    viewProj: Mat4,
    eye: Vec3,
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: Vec3,
    night: boolean
  ) {
    this.boxAt(viewProj, eye, x, h * 0.5, z, w, h, d, color);
    // windows grid
    const cols = Math.max(2, Math.floor(w / 1.4));
    const rows = Math.max(2, Math.floor(h / 2.2));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x - w * 0.5 + (c + 0.5) * (w / cols);
        const wy = 1.2 + r * (h / rows);
        const lit = night && ((r + c) % 3 !== 0);
        this.boxAt(
          viewProj,
          eye,
          wx,
          wy,
          z + d * 0.51,
          Math.min(0.55, w / cols - 0.25),
          0.7,
          0.08,
          lit ? [0.95, 0.85, 0.45] : [0.18, 0.22, 0.28],
          0,
          0,
          0,
          lit ? 0.65 : 0.35
        );
      }
    }
    // rooftop ledge
    this.boxAt(viewProj, eye, x, h + 0.15, z, w * 1.02, 0.3, d * 1.02, [color[0] * 0.75, color[1] * 0.75, color[2] * 0.75]);
  }

  render(mod: CrucibleModule) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = canvas.width;
    const h = canvas.height;
    if (w < 1 || h < 1) return;

    const clock = mod.crucible_metric_clock?.() ?? 12;
    const night = clock < 6 || clock > 20;
    if (night) gl.clearColor(0.05, 0.055, 0.09, 1);
    else if (clock < 8 || clock > 18) gl.clearColor(0.16, 0.12, 0.18, 1);
    else gl.clearColor(0.35, 0.55, 0.75, 1);

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform3fv(this.uLightDir, night ? [0.2, 0.6, 0.3] : [0.45, 0.9, 0.35]);

    const eye: Vec3 = [mod.crucible_cam_px(), mod.crucible_cam_py(), mod.crucible_cam_pz()];
    const target: Vec3 = [mod.crucible_cam_tx(), mod.crucible_cam_ty(), mod.crucible_cam_tz()];
    const proj = mat4Perspective((55 * Math.PI) / 180, w / h, 0.5, 250);
    const view = mat4LookAt(eye, target, [0, 1, 0]);
    const viewProj = mat4Multiply(proj, view);

    // ground + sidewalks
    this.boxAt(viewProj, eye, 12, -0.05, 22, 100, 0.1, 100, [0.16, 0.19, 0.16]);
    this.boxAt(viewProj, eye, 12, 0.02, 22, 90, 0.06, 8, [0.35, 0.35, 0.32]);
    this.boxAt(viewProj, eye, 12, 0.02, 12, 8, 0.06, 70, [0.35, 0.35, 0.32]);

    // street lines
    for (let i = -2; i <= 4; i++) {
      this.boxAt(viewProj, eye, 12 + i * 12, 0.04, 22, 1.2, 0.03, 70, [0.55, 0.5, 0.25]);
    }

    // street lamps
    for (let i = 0; i < 6; i++) {
      const lx = 4 + i * 12;
      this.boxAt(viewProj, eye, lx, 2.2, 26, 0.12, 4.2, 0.12, [0.25, 0.25, 0.28]);
      this.boxAt(viewProj, eye, lx, 4.4, 26, 0.45, 0.2, 0.45, night ? [0.95, 0.85, 0.5] : [0.4, 0.4, 0.35], 0, 0, 0, night ? 0.7 : 0.3);
    }

    // buildings
    const nb = mod.crucible_scene_buildings?.() ?? 0;
    for (let i = 0; i < nb; i++) {
      this.drawBuilding(
        viewProj,
        eye,
        mod.crucible_bld_x(i),
        mod.crucible_bld_z(i),
        mod.crucible_bld_w(i),
        mod.crucible_bld_h(i),
        mod.crucible_bld_d(i),
        [mod.crucible_bld_r(i), mod.crucible_bld_g(i), mod.crucible_bld_b(i)],
        night
      );
    }

    // player vehicles
    const nv = mod.crucible_scene_vehicles?.() ?? 0;
    for (let i = 0; i < nv; i++) {
      const vt = Math.max(0, Math.min(3, Math.floor(mod.crucible_metric_vtype?.() ?? 0)));
      const col = VEH_PALETTE[(i + vt) % VEH_PALETTE.length];
      this.drawVehicle(
        viewProj,
        eye,
        mod.crucible_veh_x(i),
        mod.crucible_veh_z(i),
        mod.crucible_veh_yaw(i),
        mod.crucible_veh_pitch(i),
        mod.crucible_veh_roll(i),
        col,
        (i + vt) % 4
      );
    }

    // traffic
    const nt = mod.crucible_scene_traffic?.() ?? 0;
    for (let i = 0; i < nt; i++) {
      this.drawVehicle(
        viewProj,
        eye,
        mod.crucible_tr_x(i),
        mod.crucible_tr_z(i),
        mod.crucible_tr_yaw(i),
        0,
        0,
        [mod.crucible_tr_r(i), mod.crucible_tr_g(i), mod.crucible_tr_b(i)],
        i % 4
      );
    }

    // peds
    const np = mod.crucible_scene_peds?.() ?? 0;
    const pedSuits: Vec3[] = [
      [0.35, 0.32, 0.4],
      [0.45, 0.28, 0.22],
      [0.25, 0.35, 0.4],
      [0.4, 0.4, 0.35],
    ];
    for (let i = 0; i < np; i++) {
      this.drawCharacter(
        viewProj,
        eye,
        mod.crucible_ped_x(i),
        mod.crucible_ped_z(i),
        mod.crucible_ped_yaw(i),
        pedSuits[i % pedSuits.length],
        [0.78, 0.62, 0.48],
        0.95
      );
    }

    // markers
    const nm = mod.crucible_scene_markers?.() ?? 0;
    for (let i = 0; i < nm; i++) {
      if (!mod.crucible_mk_active(i)) continue;
      const mx = mod.crucible_mk_x(i);
      const mz = mod.crucible_mk_z(i);
      const kind = mod.crucible_mk_kind(i);
      const col = MARKER_COLORS[kind] ?? MARKER_COLORS[0];
      this.boxAt(viewProj, eye, mx, 0.08, mz, 1.6, 0.12, 1.6, [col[0] * 0.4, col[1] * 0.4, col[2] * 0.4]);
      this.boxAt(viewProj, eye, mx, 1.4, mz, 0.14, 2.6, 0.14, col);
      this.boxAt(viewProj, eye, mx, 2.9, mz, 0.55, 0.55, 0.55, col);
      this.boxAt(viewProj, eye, mx, 3.25, mz, 0.32, 0.32, 0.32, [1, 1, 1]);
    }

    // player boss + green plumbob
    if (mod.crucible_metric_in_vehicle() === 0) {
      this.drawCharacter(
        viewProj,
        eye,
        mod.crucible_metric_player_x(),
        mod.crucible_metric_player_z(),
        mod.crucible_metric_yaw(),
        [0.22, 0.55, 0.35],
        [0.85, 0.7, 0.55],
        1.05,
        true
      );
    }

    gl.bindVertexArray(null);
  }

  destroy() {
    this.gl.deleteProgram(this.program);
  }
}
