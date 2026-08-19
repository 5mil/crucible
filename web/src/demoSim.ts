/** Pure-JS vertical slice when crucible.wasm is missing (cloud deploy). */
import type { CrucibleModule } from "./wasm";

type District = 0 | 1 | 2;

export function createDemoModule(): CrucibleModule {
  let frame = 0;
  const keys = new Set<number>();
  let district: District = 0;
  let bossX = 10, bossZ = 20, bossYaw = 0, onFoot = true;
  let hp = 100, heat = 0, treasury = 2500, respect = 10, day = 1, clock = 9;
  let buildings: { x: number; z: number; w: number; h: number; d: number; r: number; g: number; b: number }[] = [];
  let peds: { x: number; z: number; yaw: number; speed: number; phase: number }[] = [];
  let traffic: { x: number; z: number; yaw: number; speed: number; r: number; g: number; b: number }[] = [];
  let vehicles: { x: number; z: number; yaw: number; pitch: number; roll: number; vx: number; vz: number; speed: number; occupied: boolean; vtype: number }[] = [];
  let markers: { x: number; z: number; kind: number; active: boolean; cooldown: number; reward: number; travelTo: District }[] = [];
  let activeVeh = 0;
  let eWas = false, fWas = false, hWas = false;
  let racketAcc = 0, heatAcc = 0;

  function loadDistrict(id: District) {
    district = id;
    const fps = [
      [16,12,8,14,7],[16,24,7,11,6],[16,36,9,18,8],[28,12,6,10,6],[28,24,8,15,7],[28,36,7,12,6],
      [4,12,7,12,6],[4,24,6,9,5],[4,36,8,16,7],[-8,14,7,11,6],[-8,28,9,16,8],[-8,40,6,10,5],
      [40,14,7,13,6],[40,28,8,11,7],[40,40,6,14,5],[-20,16,6,12,5],[-20,30,7,10,6],[-20,42,8,15,6],
      [10,0,9,8,7],[24,0,6,9,5],[-4,0,7,11,6],[36,2,6,10,5],[52,16,7,12,6],[52,30,8,14,7],
      [16,50,8,12,7],[28,50,6,10,6],[4,50,7,13,6],[-8,52,8,11,7],[-22,8,5,9,5],[52,4,6,8,5],
    ];
    const colors = [[95,72,58],[68,74,92],[105,88,72],[78,62,68],[55,60,70],[110,95,80],[72,68,58],[88,78,95]];
    buildings = fps.map((f, i) => {
      const c = colors[i % colors.length];
      return { x: f[0], z: f[1], w: f[2], h: f[3], d: f[4], r: c[0]/255, g: c[1]/255, b: c[2]/255 };
    });
    peds = Array.from({ length: 22 }, (_, i) => {
      const a = i * 0.55;
      return { x: 10 + Math.sin(a) * (14 + (i % 5) * 3), z: 20 + Math.cos(a * 1.3) * (12 + (i % 4) * 2.5), yaw: a, speed: 1.0 + (i % 3) * 0.35, phase: a };
    });
    traffic = Array.from({ length: 12 }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return { x: -35 + i * 10, z: 20 + side * (3.2 + (i % 3)), yaw: side > 0 ? 0 : Math.PI, speed: 5.5 + (i % 4) * 1.2, r: (40 + (i * 37) % 120) / 255, g: (40 + (i * 53) % 100) / 255, b: (50 + (i * 19) % 90) / 255 };
    });
    vehicles = [
      { x: 12, z: 18, yaw: 0, pitch: 0, roll: 0, vx: 0, vz: 0, speed: 0, occupied: false, vtype: 0 },
      { x: 8, z: 22, yaw: 0, pitch: 0, roll: 0, vx: 0, vz: 0, speed: 0, occupied: false, vtype: 3 },
      { x: 20, z: 16, yaw: 0, pitch: 0, roll: 0, vx: 0, vz: 0, speed: 0, occupied: false, vtype: 1 },
      { x: 6, z: 18, yaw: 0, pitch: 0, roll: 0, vx: 0, vz: 0, speed: 0, occupied: false, vtype: 2 },
    ];
    if (id === 0) {
      markers = [
        { x: 16, z: 22, kind: 0, active: true, cooldown: 0, reward: 400, travelTo: 0 },
        { x: 28, z: 18, kind: 1, active: true, cooldown: 0, reward: 150, travelTo: 0 },
        { x: 10, z: 8, kind: 2, active: true, cooldown: 0, reward: 0, travelTo: 0 },
        { x: 22, z: 30, kind: 3, active: true, cooldown: 0, reward: 0, travelTo: 0 },
        { x: 48, z: 20, kind: 4, active: true, cooldown: 0, reward: 0, travelTo: 1 },
        { x: 12, z: 52, kind: 4, active: true, cooldown: 0, reward: 0, travelTo: 2 },
      ];
    } else if (id === 1) {
      markers = [
        { x: 18, z: 20, kind: 0, active: true, cooldown: 0, reward: 350, travelTo: 1 },
        { x: 10, z: 8, kind: 2, active: true, cooldown: 0, reward: 0, travelTo: 1 },
        { x: 48, z: 20, kind: 4, active: true, cooldown: 0, reward: 0, travelTo: 2 },
        { x: -18, z: 20, kind: 4, active: true, cooldown: 0, reward: 0, travelTo: 0 },
      ];
    } else {
      markers = [
        { x: 20, z: 24, kind: 0, active: true, cooldown: 0, reward: 500, travelTo: 2 },
        { x: 10, z: 8, kind: 2, active: true, cooldown: 0, reward: 0, travelTo: 2 },
        { x: -18, z: 20, kind: 4, active: true, cooldown: 0, reward: 0, travelTo: 1 },
        { x: 12, z: -2, kind: 4, active: true, cooldown: 0, reward: 0, travelTo: 0 },
      ];
    }
    bossX = 10; bossZ = 20; onFoot = true;
  }
  loadDistrict(0);

  function drive(v: typeof vehicles[0], throttle: number, steer: number, handbrake: boolean, dt: number) {
    const mass = 1200, power = 9200, grip = handbrake ? 0.3 : 1.05;
    const speed = Math.hypot(v.vx, v.vz);
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    const vLong = v.vx * cy + v.vz * sy;
    let fLong = throttle > 0.05 ? throttle * power * Math.max(0.15, 1 - speed / 18) : throttle < -0.05 ? throttle * 14000 : 0;
    fLong -= Math.sign(vLong) * 180 + 0.42 * vLong * Math.abs(vLong);
    const vLat = v.vx * -sy + v.vz * cy;
    let fLat = Math.max(-mass * 9.81 * grip, Math.min(mass * 9.81 * grip, -vLat * mass * 8 * grip));
    v.vx += ((cy * fLong + -sy * fLat) / mass) * dt;
    v.vz += ((sy * fLong + cy * fLat) / mass) * dt;
    v.yaw += steer * 0.55 * (1 / (1 + speed * 0.08)) * speed * 0.04 * dt;
    v.x += v.vx * dt; v.z += v.vz * dt;
    v.speed = Math.hypot(v.vx, v.vz);
    v.pitch += ((-throttle * 0.04) - v.pitch) * Math.min(1, 8 * dt);
    v.roll += ((steer * speed * 0.02) - v.roll) * Math.min(1, 8 * dt);
  }

  function interact() {
    let best = -1, bestD = 12.25;
    markers.forEach((m, i) => {
      if (!m.active || m.cooldown > 0) return;
      const dd = (bossX - m.x) ** 2 + (bossZ - m.z) ** 2;
      if (dd < bestD) { bestD = dd; best = i; }
    });
    if (best < 0) return;
    const m = markers[best];
    if (m.kind === 0) { treasury += m.reward; respect += 5; heat = Math.min(100, heat + 8); m.cooldown = 45; }
    else if (m.kind === 1) { treasury += m.reward; m.cooldown = 20; }
    else if (m.kind === 2) { hp = 100; heat = Math.max(0, heat - 10); m.cooldown = 15; }
    else if (m.kind === 3) { if (treasury >= 50) { treasury -= 50; hp = Math.min(100, hp + 40); m.cooldown = 10; } }
    else if (m.kind === 4) loadDistrict(m.travelTo);
  }

  const z = () => 0;
  const mod: CrucibleModule = {
    crucible_init() { loadDistrict(0); },
    crucible_frame(dt) {
      const d = dt > 0 && dt < 0.25 ? dt : 1 / 60;
      frame++;
      let mx = 0, my = 0;
      if (keys.has(65)) mx -= 1; if (keys.has(68)) mx += 1;
      if (keys.has(87)) my += 1; if (keys.has(83)) my -= 1;
      const e = keys.has(69), f = keys.has(70), h = keys.has(72), shift = keys.has(16);
      const eEdge = e && !eWas; eWas = e;
      const fEdge = f && !fWas; fWas = f;
      const hEdge = h && !hWas; hWas = h;
      clock += d * (24 / 600);
      if (clock >= 24) { clock -= 24; day++; treasury += 80; heat = Math.max(0, heat - 5); }
      heatAcc += d; if (heatAcc > 4) { heatAcc = 0; if (heat > 0) heat--; }
      markers.forEach((m) => { if (m.cooldown > 0) m.cooldown -= d; });
      if (hEdge && onFoot && hp < 100) hp = Math.min(100, hp + 25);
      if (fEdge && onFoot) vehicles[activeVeh].vtype = (vehicles[activeVeh].vtype + 1) % 4;
      if (onFoot) {
        bossX += mx * 6.5 * d; bossZ += my * 6.5 * d;
        if (mx || my) bossYaw = Math.atan2(my, mx);
        if (eEdge) {
          let bi = -1, bd = 16;
          vehicles.forEach((v, i) => { const dd = (bossX - v.x) ** 2 + (bossZ - v.z) ** 2; if (dd < bd) { bd = dd; bi = i; } });
          if (bi >= 0) { activeVeh = bi; vehicles[bi].occupied = true; vehicles[bi].yaw = bossYaw; onFoot = false; }
          else interact();
        }
      } else {
        const v = vehicles[activeVeh];
        drive(v, my, mx, shift, d);
        bossX = v.x; bossZ = v.z; bossYaw = v.yaw;
        if (v.speed > 12 && frame % 30 === 0) heat = Math.min(100, heat + 1);
        if (eEdge) { v.occupied = false; v.vx = 0; v.vz = 0; v.speed = 0; onFoot = true; bossX += Math.cos(v.yaw + 1.57) * 1.5; bossZ += Math.sin(v.yaw + 1.57) * 1.5; }
      }
      peds.forEach((p) => { p.phase += d * 0.4; p.yaw += Math.sin(p.phase) * 0.3 * d; p.x += Math.cos(p.yaw) * p.speed * d; p.z += Math.sin(p.yaw) * p.speed * d; });
      traffic.forEach((c) => { c.x += Math.cos(c.yaw) * c.speed * d; if (c.x > 55) c.x = -35; if (c.x < -35) c.x = 55; });
      racketAcc += d; if (racketAcc > 30) { racketAcc = 0; treasury += 35; }
    },
    crucible_key(key, down) { if (down) keys.add(key); else keys.delete(key); },
    crucible_pointer: z as any, crucible_resize: z as any, crucible_shutdown() { keys.clear(); },
    crucible_version: () => 6,
    crucible_metric_player_x: () => bossX, crucible_metric_player_z: () => bossZ, crucible_metric_yaw: () => bossYaw,
    crucible_metric_speed: () => (onFoot ? 0 : vehicles[activeVeh].speed),
    crucible_metric_in_vehicle: () => (onFoot ? 0 : 1),
    crucible_metric_draw_calls: () => buildings.length + peds.length,
    crucible_metric_frame: () => frame,
    crucible_metric_pitch: () => (onFoot ? 0 : vehicles[activeVeh].pitch),
    crucible_metric_roll: () => (onFoot ? 0 : vehicles[activeVeh].roll),
    crucible_metric_vtype: () => vehicles[activeVeh].vtype,
    crucible_metric_health: () => hp, crucible_metric_heat: () => heat, crucible_metric_treasury: () => treasury,
    crucible_metric_day: () => day, crucible_metric_clock: () => clock, crucible_metric_respect: () => respect,
    crucible_metric_district: () => district,
    crucible_cam_px: () => bossX - Math.cos(bossYaw) * (onFoot ? 12 : 15) + Math.sin(bossYaw) * 2.5,
    crucible_cam_py: () => (onFoot ? 11.5 : 13.5),
    crucible_cam_pz: () => bossZ - Math.sin(bossYaw) * (onFoot ? 12 : 15) - Math.cos(bossYaw) * 2.5,
    crucible_cam_tx: () => bossX, crucible_cam_ty: () => 1.2, crucible_cam_tz: () => bossZ,
    crucible_scene_buildings: () => buildings.length, crucible_scene_peds: () => peds.length,
    crucible_scene_traffic: () => traffic.length, crucible_scene_vehicles: () => vehicles.length,
    crucible_scene_markers: () => markers.length,
    crucible_bld_x: (i) => buildings[i]?.x ?? 0, crucible_bld_z: (i) => buildings[i]?.z ?? 0,
    crucible_bld_w: (i) => buildings[i]?.w ?? 1, crucible_bld_h: (i) => buildings[i]?.h ?? 1,
    crucible_bld_d: (i) => buildings[i]?.d ?? 1, crucible_bld_r: (i) => buildings[i]?.r ?? 0.5,
    crucible_bld_g: (i) => buildings[i]?.g ?? 0.5, crucible_bld_b: (i) => buildings[i]?.b ?? 0.5,
    crucible_ped_x: (i) => peds[i]?.x ?? 0, crucible_ped_z: (i) => peds[i]?.z ?? 0, crucible_ped_yaw: (i) => peds[i]?.yaw ?? 0,
    crucible_tr_x: (i) => traffic[i]?.x ?? 0, crucible_tr_z: (i) => traffic[i]?.z ?? 0, crucible_tr_yaw: (i) => traffic[i]?.yaw ?? 0,
    crucible_tr_r: (i) => traffic[i]?.r ?? 0.3, crucible_tr_g: (i) => traffic[i]?.g ?? 0.3, crucible_tr_b: (i) => traffic[i]?.b ?? 0.3,
    crucible_veh_x: (i) => vehicles[i]?.x ?? 0, crucible_veh_z: (i) => vehicles[i]?.z ?? 0,
    crucible_veh_yaw: (i) => vehicles[i]?.yaw ?? 0, crucible_veh_pitch: (i) => vehicles[i]?.pitch ?? 0,
    crucible_veh_roll: (i) => vehicles[i]?.roll ?? 0, crucible_veh_occupied: (i) => (vehicles[i]?.occupied ? 1 : 0),
    crucible_mk_x: (i) => markers[i]?.x ?? 0, crucible_mk_z: (i) => markers[i]?.z ?? 0,
    crucible_mk_kind: (i) => markers[i]?.kind ?? 0,
    crucible_mk_active: (i) => (markers[i] && markers[i].active && markers[i].cooldown <= 0 ? 1 : 0),
    crucible_load_state(d, of, hpv, ht, tr, re, dy, cl, x, z, yaw) {
      loadDistrict(Math.max(0, Math.min(2, d)) as District);
      treasury = tr; respect = re; day = dy; clock = cl; hp = hpv; heat = ht;
      bossX = x; bossZ = z; bossYaw = yaw; onFoot = of !== 0;
    },
    crucible_travel(d) { loadDistrict(Math.max(0, Math.min(2, d)) as District); },
  };
  return mod;
}
