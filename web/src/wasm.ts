/** Loader for Crucible WASM (ABI v6). */

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
  crucible_metric_district(): number;
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
  crucible_load_state(
    district: number, on_foot: number, hp: number, heat: number,
    treasury: number, respect: number, day: number, clock: number,
    x: number, z: number, yaw: number
  ): void;
  crucible_travel(district: number): void;
}

function bindAll(exports: Record<string, unknown>): CrucibleModule {
  const bind = (name: string) => {
    const fn = exports[name];
    if (typeof fn !== "function") return (() => 0) as never;
    return (fn as Function).bind(exports) as never;
  };
  const keys = [
    "crucible_init","crucible_frame","crucible_key","crucible_pointer","crucible_resize",
    "crucible_shutdown","crucible_version","crucible_metric_player_x","crucible_metric_player_z",
    "crucible_metric_yaw","crucible_metric_speed","crucible_metric_in_vehicle","crucible_metric_draw_calls",
    "crucible_metric_frame","crucible_metric_pitch","crucible_metric_roll","crucible_metric_vtype",
    "crucible_metric_health","crucible_metric_heat","crucible_metric_treasury","crucible_metric_day",
    "crucible_metric_clock","crucible_metric_respect","crucible_metric_district","crucible_cam_px",
    "crucible_cam_py","crucible_cam_pz","crucible_cam_tx","crucible_cam_ty","crucible_cam_tz",
    "crucible_scene_buildings","crucible_scene_peds","crucible_scene_traffic","crucible_scene_vehicles",
    "crucible_scene_markers","crucible_bld_x","crucible_bld_z","crucible_bld_w","crucible_bld_h",
    "crucible_bld_d","crucible_bld_r","crucible_bld_g","crucible_bld_b","crucible_ped_x","crucible_ped_z",
    "crucible_ped_yaw","crucible_tr_x","crucible_tr_z","crucible_tr_yaw","crucible_tr_r","crucible_tr_g",
    "crucible_tr_b","crucible_veh_x","crucible_veh_z","crucible_veh_yaw","crucible_veh_pitch",
    "crucible_veh_roll","crucible_veh_occupied","crucible_mk_x","crucible_mk_z","crucible_mk_kind",
    "crucible_mk_active","crucible_load_state","crucible_travel",
  ];
  const out: Record<string, unknown> = {};
  for (const n of keys) out[n] = bind(n);
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
