/**
 * WebGL2 host renderer — full vertical-slice scene from WASM exports.
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
out vec4 fragColor;
void main() {
  vec3 n = normalize(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  float amb = 0.28;
  vec3 view = normalize(uEye - vWorld);
  vec3 h = normalize(normalize(uLightDir) + view);
  float spec = pow(max(dot(n, h), 0.0), 32.0) * 0.2;
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

export class GlRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private box: { vao: WebGLVertexArrayObject; indexCount: number };
  private uMVP: WebGLUniformLocation;
  private uModel: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uLightDir: WebGLUniformLocation;
  private uEye: WebGLUniformLocation;

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
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  }

  resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
  }

  private drawBox(viewProj: Mat4, model: Mat4, color: Vec3, eye: Vec3) {
    const gl = this.gl;
    const mvp = mat4Multiply(viewProj, model);
    gl.uniformMatrix4fv(this.uMVP, false, mvp);
    gl.uniformMatrix4fv(this.uModel, false, model);
    gl.uniform3fv(this.uColor, color);
    gl.uniform3fv(this.uEye, eye);
    gl.bindVertexArray(this.box.vao);
    gl.drawElements(gl.TRIANGLES, this.box.indexCount, gl.UNSIGNED_SHORT, 0);
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
    else gl.clearColor(0.09, 0.11, 0.14, 1);

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform3fv(this.uLightDir, night ? [0.2, 0.6, 0.3] : [0.4, 0.85, 0.35]);

    const eye: Vec3 = [mod.crucible_cam_px(), mod.crucible_cam_py(), mod.crucible_cam_pz()];
    const target: Vec3 = [mod.crucible_cam_tx(), mod.crucible_cam_ty(), mod.crucible_cam_tz()];
    const proj = mat4Perspective((55 * Math.PI) / 180, w / h, 0.5, 250);
    const view = mat4LookAt(eye, target, [0, 1, 0]);
    const viewProj = mat4Multiply(proj, view);

    {
      let m = mat4Identity();
      m = mat4Translate(m, [12, -0.05, 22]);
      m = mat4Scale(m, [100, 0.1, 100]);
      this.drawBox(viewProj, m, [0.16, 0.19, 0.16], eye);
    }

    for (let i = -2; i <= 4; i++) {
      let mx = mat4Identity();
      mx = mat4Translate(mx, [12 + i * 12, 0.01, 22]);
      mx = mat4Scale(mx, [1.4, 0.04, 80]);
      this.drawBox(viewProj, mx, [0.22, 0.22, 0.2], eye);
    }
    for (let i = -1; i <= 4; i++) {
      let mz = mat4Identity();
      mz = mat4Translate(mz, [12, 0.01, 10 + i * 10]);
      mz = mat4Scale(mz, [70, 0.04, 1.4]);
      this.drawBox(viewProj, mz, [0.22, 0.22, 0.2], eye);
    }

    const nb = mod.crucible_scene_buildings?.() ?? 0;
    for (let i = 0; i < nb; i++) {
      let m = mat4Identity();
      const bh = mod.crucible_bld_h(i);
      m = mat4Translate(m, [mod.crucible_bld_x(i), bh * 0.5, mod.crucible_bld_z(i)]);
      m = mat4Scale(m, [mod.crucible_bld_w(i), bh, mod.crucible_bld_d(i)]);
      this.drawBox(viewProj, m, [mod.crucible_bld_r(i), mod.crucible_bld_g(i), mod.crucible_bld_b(i)], eye);
    }

    const nv = mod.crucible_scene_vehicles?.() ?? 0;
    for (let i = 0; i < nv; i++) {
      let body = mat4Identity();
      body = mat4Translate(body, [mod.crucible_veh_x(i), 0.55, mod.crucible_veh_z(i)]);
      body = mat4Multiply(body, mat4FromYawPitchRoll(mod.crucible_veh_yaw(i), mod.crucible_veh_pitch(i), mod.crucible_veh_roll(i)));
      body = mat4Scale(body, [2.0, 0.85, 3.8]);
      this.drawBox(viewProj, body, [0.7, 0.16, 0.14], eye);
    }

    const nt = mod.crucible_scene_traffic?.() ?? 0;
    for (let i = 0; i < nt; i++) {
      let body = mat4Identity();
      body = mat4Translate(body, [mod.crucible_tr_x(i), 0.5, mod.crucible_tr_z(i)]);
      body = mat4Multiply(body, mat4FromYawPitchRoll(mod.crucible_tr_yaw(i), 0, 0));
      body = mat4Scale(body, [1.8, 0.8, 3.4]);
      this.drawBox(viewProj, body, [mod.crucible_tr_r(i), mod.crucible_tr_g(i), mod.crucible_tr_b(i)], eye);
    }

    const np = mod.crucible_scene_peds?.() ?? 0;
    for (let i = 0; i < np; i++) {
      const px = mod.crucible_ped_x(i);
      const pz = mod.crucible_ped_z(i);
      const yaw = mod.crucible_ped_yaw(i);
      let torso = mat4Identity();
      torso = mat4Translate(torso, [px, 0.9, pz]);
      torso = mat4Multiply(torso, mat4FromYawPitchRoll(yaw, 0, 0));
      torso = mat4Scale(torso, [0.45, 1.0, 0.35]);
      this.drawBox(viewProj, torso, [0.55, 0.5, 0.42], eye);
      let head = mat4Identity();
      head = mat4Translate(head, [px, 1.55, pz]);
      head = mat4Scale(head, [0.28, 0.28, 0.28]);
      this.drawBox(viewProj, head, [0.8, 0.65, 0.5], eye);
    }

    const nm = mod.crucible_scene_markers?.() ?? 0;
    for (let i = 0; i < nm; i++) {
      if (!mod.crucible_mk_active(i)) continue;
      const mx = mod.crucible_mk_x(i);
      const mz = mod.crucible_mk_z(i);
      const col = MARKER_COLORS[mod.crucible_mk_kind(i)] ?? MARKER_COLORS[0];
      let m = mat4Identity();
      m = mat4Translate(m, [mx, 0.2, mz]);
      m = mat4Scale(m, [1.4, 0.35, 1.4]);
      this.drawBox(viewProj, m, col, eye);
      let pole = mat4Identity();
      pole = mat4Translate(pole, [mx, 1.2, mz]);
      pole = mat4Scale(pole, [0.15, 2.2, 0.15]);
      this.drawBox(viewProj, pole, col, eye);
    }

    if (mod.crucible_metric_in_vehicle() === 0) {
      const px = mod.crucible_metric_player_x();
      const pz = mod.crucible_metric_player_z();
      const yaw = mod.crucible_metric_yaw();
      let torso = mat4Identity();
      torso = mat4Translate(torso, [px, 0.9, pz]);
      torso = mat4Multiply(torso, mat4FromYawPitchRoll(yaw, 0, 0));
      torso = mat4Scale(torso, [0.55, 1.1, 0.4]);
      this.drawBox(viewProj, torso, [0.3, 0.7, 0.45], eye);
      let head = mat4Identity();
      head = mat4Translate(head, [px, 1.7, pz]);
      head = mat4Scale(head, [0.35, 0.35, 0.35]);
      this.drawBox(viewProj, head, [0.85, 0.7, 0.55], eye);
    }

    gl.bindVertexArray(null);
  }

  destroy() {
    this.gl.deleteProgram(this.program);
  }
}
