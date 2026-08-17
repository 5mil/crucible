/**
 * Thin loader for the Crucible WASM module.
 *
 * Expects `crucible.wasm` (or `crucible.wasm` produced by `zig build -Dweb=true`)
 * to be present in /public after the Zig build step.
 */

export interface CrucibleModule {
  crucible_init(width: number, height: number): void;
  crucible_frame(dt: number): void;
  crucible_key(key: number, down: number): void;
  crucible_pointer(x: number, y: number, buttons: number): void;
  crucible_resize(width: number, height: number): void;
  crucible_shutdown(): void;
  crucible_version(): number;
}

export async function loadCrucible(): Promise<CrucibleModule> {
  // Zig freestanding wasm usually needs a minimal env / memory.
  // We start with the simplest possible instantiation; once the real
  // backend is wired we may need a small import object for WebGL calls.
  const importObject: WebAssembly.Imports = {
    env: {
      // Placeholder for future JS→Zig callbacks (e.g. WebGL wrappers)
      // abort: () => {},
    },
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

  const exports = instance.exports as unknown as CrucibleModule & {
    memory?: WebAssembly.Memory;
  };

  // Basic sanity check
  if (typeof exports.crucible_version !== "function") {
    throw new Error(
      "WASM module loaded but crucible_version export is missing. " +
        "Check that you built the correct target."
    );
  }

  return {
    crucible_init: exports.crucible_init.bind(exports),
    crucible_frame: exports.crucible_frame.bind(exports),
    crucible_key: exports.crucible_key.bind(exports),
    crucible_pointer: exports.crucible_pointer.bind(exports),
    crucible_resize: exports.crucible_resize.bind(exports),
    crucible_shutdown: exports.crucible_shutdown.bind(exports),
    crucible_version: exports.crucible_version.bind(exports),
  };
}
