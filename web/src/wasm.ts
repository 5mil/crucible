/**
 * Loader for the Crucible WASM module (ABI v3).
 *
 * Expects /crucible.wasm from: zig build -Dweb=true -Doptimize=ReleaseFast
 */

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
  crucible_cam_px(): number;
  crucible_cam_py(): number;
  crucible_cam_pz(): number;
  crucible_cam_tx(): number;
  crucible_cam_ty(): number;
  crucible_cam_tz(): number;
}

export async function loadCrucible(): Promise<CrucibleModule> {
  const importObject: WebAssembly.Imports = {
    env: {},
  };

  const response = await fetch("/crucible.wasm");
  if (!response.ok) {
    throw new Error(
      `Could not fetch /crucible.wasm (${response.status}). ` +
        `Run: zig build -Dweb=true -Doptimize=ReleaseFast`
    );
  }

  const { instance } = await WebAssembly.instantiateStreaming(
    response,
    importObject
  );

  const exports = instance.exports as unknown as CrucibleModule;

  if (typeof exports.crucible_version !== "function") {
    throw new Error(
      "WASM module loaded but crucible_version export is missing."
    );
  }

  const bind = <K extends keyof CrucibleModule>(name: K): CrucibleModule[K] => {
    const fn = exports[name];
    if (typeof fn !== "function") {
      return (() => 0) as CrucibleModule[K];
    }
    return (fn as Function).bind(exports) as CrucibleModule[K];
  };

  return {
    crucible_init: bind("crucible_init"),
    crucible_frame: bind("crucible_frame"),
    crucible_key: bind("crucible_key"),
    crucible_pointer: bind("crucible_pointer"),
    crucible_resize: bind("crucible_resize"),
    crucible_shutdown: bind("crucible_shutdown"),
    crucible_version: bind("crucible_version"),
    crucible_metric_player_x: bind("crucible_metric_player_x"),
    crucible_metric_player_z: bind("crucible_metric_player_z"),
    crucible_metric_yaw: bind("crucible_metric_yaw"),
    crucible_metric_speed: bind("crucible_metric_speed"),
    crucible_metric_in_vehicle: bind("crucible_metric_in_vehicle"),
    crucible_metric_draw_calls: bind("crucible_metric_draw_calls"),
    crucible_metric_frame: bind("crucible_metric_frame"),
    crucible_metric_pitch: bind("crucible_metric_pitch"),
    crucible_metric_roll: bind("crucible_metric_roll"),
    crucible_cam_px: bind("crucible_cam_px"),
    crucible_cam_py: bind("crucible_cam_py"),
    crucible_cam_pz: bind("crucible_cam_pz"),
    crucible_cam_tx: bind("crucible_cam_tx"),
    crucible_cam_ty: bind("crucible_cam_ty"),
    crucible_cam_tz: bind("crucible_cam_tz"),
  };
}

/** Map KeyboardEvent to codes the Zig backend expects. */
export function keyEventToCode(e: KeyboardEvent): number {
  switch (e.code) {
    case "KeyW":
      return 87;
    case "KeyA":
      return 65;
    case "KeyS":
      return 83;
    case "KeyD":
      return 68;
    case "KeyE":
      return 69;
    case "KeyF":
      return 70;
    case "ShiftLeft":
    case "ShiftRight":
      return 16;
    case "Escape":
      return 27;
    case "Space":
      return 32;
    default:
      return e.keyCode || 0;
  }
}

export function snapshotFromModule(mod: CrucibleModule) {
  return {
    playerX: mod.crucible_metric_player_x(),
    playerZ: mod.crucible_metric_player_z(),
    yaw: mod.crucible_metric_yaw(),
    pitch: mod.crucible_metric_pitch(),
    roll: mod.crucible_metric_roll(),
    inVehicle: mod.crucible_metric_in_vehicle() !== 0,
    cam: {
      px: mod.crucible_cam_px(),
      py: mod.crucible_cam_py(),
      pz: mod.crucible_cam_pz(),
      tx: mod.crucible_cam_tx(),
      ty: mod.crucible_cam_ty(),
      tz: mod.crucible_cam_tz(),
    },
  };
}
