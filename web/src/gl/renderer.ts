/**
 * WebGL2 host renderer for Crucible.
 * Consumes scene snapshot from WASM metrics and draws the vertical slice.
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
  float spec = pow(max(dot(n, h), 0.0), 32.0) * 0.25;
  vec3 col = uColor * (amb + ndl * 0.72) + vec3(spec);
  fragColor = vec4(col, 1.0);
}
`;

export interface SceneSnapshot {
  playerX: number;
  playerZ: number;
  yaw: number;
  pitch: number;
  roll: number;
  inVehicle: boolean;
  cam: { px: number; py: number; pz: number; tx: number; ty: number; tz: number };
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile: ${log}`);
  }
  return s;
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`Program link: ${log}`);
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
    for (const v of f.verts) {
      data.push(v[0], v[1], v[2], f.n[0], f.n[1], f.n[2]);
    }
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

const BUILDINGS: { pos: Vec3; size: Vec3; color: Vec3 }[] = [
  { pos: [12, 5, 8], size: [6, 10, 6], color: [0.35, 0.27, 0.24] },
  { pos: [-14, 7, 10], size: [5, 14, 5], color: [0.27, 0.29, 0.35] },
  { pos: [8, 4, -12], size: [8, 8, 7], color: [0.39, 0.33, 0.27] },
  { pos: [-8, 3, -6], size: [4, 6, 4], color: [0.3, 0.32, 0.28] },
  { pos: [18, 6, -4], size: [5, 12, 5], color: [0.32, 0.26, 0.3] },
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
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      depth: true,
    });
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
    gl.cullFace(gl.BACK);
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

  render(scene: SceneSnapshot) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = canvas.width;
    const h = canvas.height;
    if (w < 1 || h < 1) return;

    gl.viewport(0, 0, w, h);
    gl.clearColor(0.09, 0.11, 0.14, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniform3fv(this.uLightDir, [0.4, 0.85, 0.35]);

    const eye: Vec3 = [scene.cam.px, scene.cam.py, scene.cam.pz];
    const target: Vec3 = [scene.cam.tx, scene.cam.ty, scene.cam.tz];
    const proj = mat4Perspective((55 * Math.PI) / 180, w / h, 0.5, 200);
    const view = mat4LookAt(eye, target, [0, 1, 0]);
    const viewProj = mat4Multiply(proj, view);

    {
      let m = mat4Identity();
      m = mat4Translate(m, [0, -0.05, 0]);
      m = mat4Scale(m, [80, 0.1, 80]);
      this.drawBox(viewProj, m, [0.16, 0.19, 0.16], eye);
    }

    for (let i = -3; i <= 3; i++) {
      let mx = mat4Identity();
      mx = mat4Translate(mx, [i * 12, 0.01, 0]);
      mx = mat4Scale(mx, [1.2, 0.05, 70]);
      this.drawBox(viewProj, mx, [0.22, 0.22, 0.2], eye);
      let mz = mat4Identity();
      mz = mat4Translate(mz, [0, 0.01, i * 12]);
      mz = mat4Scale(mz, [70, 0.05, 1.2]);
      this.drawBox(viewProj, mz, [0.22, 0.22, 0.2], eye);
    }

    for (const b of BUILDINGS) {
      let m = mat4Identity();
      m = mat4Translate(m, b.pos);
      m = mat4Scale(m, b.size);
      this.drawBox(viewProj, m, b.color, eye);
    }

    if (scene.inVehicle) {
      let body = mat4Identity();
      body = mat4Translate(body, [scene.playerX, 0.55, scene.playerZ]);
      body = mat4Multiply(body, mat4FromYawPitchRoll(scene.yaw, scene.pitch, scene.roll));
      body = mat4Scale(body, [2.2, 0.9, 4.2]);
      this.drawBox(viewProj, body, [0.7, 0.16, 0.14], eye);

      let cabin = mat4Identity();
      cabin = mat4Translate(cabin, [scene.playerX, 1.15, scene.playerZ]);
      cabin = mat4Multiply(cabin, mat4FromYawPitchRoll(scene.yaw, scene.pitch, scene.roll));
      cabin = mat4Scale(cabin, [1.8, 0.7, 2.0]);
      this.drawBox(viewProj, cabin, [0.55, 0.12, 0.12], eye);
    } else {
      let torso = mat4Identity();
      torso = mat4Translate(torso, [scene.playerX, 0.9, scene.playerZ]);
      torso = mat4Multiply(torso, mat4FromYawPitchRoll(scene.yaw, 0, 0));
      torso = mat4Scale(torso, [0.55, 1.1, 0.4]);
      this.drawBox(viewProj, torso, [0.3, 0.7, 0.45], eye);

      let head = mat4Identity();
      head = mat4Translate(head, [scene.playerX, 1.7, scene.playerZ]);
      head = mat4Scale(head, [0.35, 0.35, 0.35]);
      this.drawBox(viewProj, head, [0.85, 0.7, 0.55], eye);
    }

    gl.bindVertexArray(null);
  }

  destroy() {
    this.gl.deleteProgram(this.program);
  }
}
