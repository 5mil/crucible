/** Loader for Crucible WASM (ABI v5 — full vertical slice). */

export interface CrucibleModule {
  crucible_init(width: number, height: number): void;
  crucible_frame(dt: number): void;
  crucible_key(key: number, down: number): void;
  crucible_pointer(x: number, y: number, buttons: number): void;
  crucible_resize(width: number, height: number): void;
  crucible_shutdown(): void;
  crucible_version(): number;
  crucible_metric_player_x(): number;
  crucible_metric_player_z(): number;
  crucible_metric_yaw(): number;
  crucible_metric_speed(): number;
  crucible_metric_in_vehicle(): number;
  crucible_metric_draw_calls(): number;
  crucible_metric_frame(): number;
  crucible_metric_pitch(): number;
  crucible_metric_roll(): number;
  crucible_metric_vtype(): number;
  crucible_metric_health(): number;
  crucible_metric_heat(): number;
  crucible_metric_treasury(): number;
  crucible_metric_day(): number;
  crucible_metric_clock(): number;
  crucible_metric_respect(): number;
  crucible_cam_px(): number;
  crucible_cam_py(): number;
  crucible_cam_pz(): number;
  crucible_cam_tx(): number;
  crucible_cam_ty(): number;
  crucible_cam_tz(): number;
  crucible_scene_buildings(): number;
  crucible_scene_peds(): number;
  crucible_scene_traffic(): number;
  crucible_scene_vehicles(): number;
  crucible_scene_markers(): number;
  crucible_bld_x(i: number): number;
  crucible_bld_z(i: number): number;
  crucible_bld_w(i: number): number;
  crucible_bld_h(i: number): number;
  crucible_bld_d(i: number): number;
  crucible_bld_r(i: number): number;
  crucible_bld_g(i: number): number;
  crucible_bld_b(i: number): number;
  crucible_ped_x(i: number): number;
  crucible_ped_z(i: number): number;
  crucible_ped_yaw(i: number): number;
  crucible_tr_x(i: number): number;
  crucible_tr_z(i: number): number;
  crucible_tr_yaw(i: number): number;
  crucible_tr_r(i: number): number;
  crucible_tr_g(i: number): number;
  crucible_tr_b(i: number): number;
  crucible_veh_x(i: number): number;
  crucible_veh_z(i: number): number;
  crucible_veh_yaw(i: number): number;
  crucible_veh_pitch(i: number): number;
  crucible_veh_roll(i: number): number;
  crucible_veh_occupied(i: number): number;
  crucible_mk_x(i: number): number;
  crucible_mk_z(i: number): number;
  crucible_mk_kind(i: number): number;
  crucible_mk_active(i: number): number;
}

function bindAll(exports: Record<string, unknown>): CrucibleModule {
  const bind = (name: string) => {
    const fn = exports[name];
    if (typeof fn !== "function") return (() => 0) as never;
    return (fn as Function).bind(exports) as never;
  };
  const names = Object.keys({
    crucible_init: 1, crucible_frame: 1, crucible_key: 1, crucible_pointer: 1, crucible_resize: 1,
    crucible_shutdown: 1, crucible_version: 1, crucible_metric_player_x: 1, crucible_metric_player_z: 1,
    crucible_metric_yaw: 1, crucible_metric_speed: 1, crucible_metric_in_vehicle: 1, crucible_metric_draw_calls: 1,
    crucible_metric_frame: 1, crucible_metric_pitch: 1, crucible_metric_roll: 1, crucible_metric_vtype: 1,
    crucible_metric_health: 1, crucible_metric_heat: 1, crucible_metric_treasury: 1, crucible_metric_day: 1,
    crucible_metric_clock: 1, crucible_metric_respect: 1, crucible_cam_px: 1, crucible_cam_py: 1, crucible_cam_pz: 1,
    crucible_cam_tx: 1, crucible_cam_ty: 1, crucible_cam_tz: 1, crucible_scene_buildings: 1, crucible_scene_peds: 1,
    crucible_scene_traffic: 1, crucible_scene_vehicles: 1, crucible_scene_markers: 1, crucible_bld_x: 1, crucible_bld_z: 1,
    crucible_bld_w: 1, crucible_bld_h: 1, crucible_bld_d: 1, crucible_bld_r: 1, crucible_bld_g: 1, crucible_bld_b: 1,
    crucible_ped_x: 1, crucible_ped_z: 1, crucible_ped_yaw: 1, crucible_tr_x: 1, crucible_tr_z: 1, crucible_tr_yaw: 1,
    crucible_tr_r: 1, crucible_tr_g: 1, crucible_tr_b: 1, crucible_veh_x: 1, crucible_veh_z: 1, crucible_veh_yaw: 1,
    crucible_veh_pitch: 1, crucible_veh_roll: 1, crucible_veh_occupied: 1, crucible_mk_x: 1, crucible_mk_z: 1,
    crucible_mk_kind: 1, crucible_mk_active: 1,
  });
  const out: Record<string, unknown> = {};
  for (const n of names) out[n] = bind(n);
  return out as unknown as CrucibleModule;
}

export async function loadCrucible(): Promise<CrucibleModule> {
  const response = await fetch("/crucible.wasm");
  if (!response.ok) {
    throw new Error(`Could not fetch /crucible.wasm (${response.status}). Run: zig build -Dweb=true -Doptimize=ReleaseFast`);
  }
  const { instance } = await WebAssembly.instantiateStreaming(response, { env: {} });
  return bindAll(instance.exports as Record<string, unknown>);
}

export function keyEventToCode(e: KeyboardEvent): number {
  switch (e.code) {
    case "KeyW": return 87;
    case "KeyA": return 65;
    case "KeyS": return 83;
    case "KeyD": return 68;
    case "KeyE": return 69;
    case "KeyF": return 70;
    case "KeyH": return 72;
    case "ShiftLeft":
    case "ShiftRight": return 16;
    case "Escape": return 27;
    case "Space": return 32;
    default: return e.keyCode || 0;
  }
}
