# Crucible Architecture

## Goal

Run the **entire** Empire & Kin vertical slice (and later the full game) inside a browser at still-reasonable settings, with a robust testing harness on top.

## Key Design Decisions

1. **Separate repository**  
   Crucible is independent of `5mil/empire-and-kin`. This keeps the game’s history clean and lets the test product evolve freely.

2. **Submodule for the game**  
   `vendor/empire-and-kin` points at the real game repo. All game logic, physics, scene, and asset continuum stay in one place.

3. **Backend VTable is the contract**  
   Empire & Kin already has a clean VTable for GL / GLES / Android / Null. Crucible adds a `WebGLBackend` that implements the same interface. The simulation does not care which host is driving it.

4. **WASM + thin JS host**  
   Zig compiles to `wasm32-freestanding`. A small exported C ABI (`crucible_init`, `crucible_frame`, …) is the only surface the React host needs.

5. **Robust web stack**  
   Vite + React + TypeScript for the harness UI. This gives us a solid foundation for complex testing controls (live PhysTuning, recording, metrics, multi-scenario switching) without fighting the framework.

## Data Flow

```
Browser
  └─ React harness (input, UI, telemetry)
       └─ canvas + keyboard/pointer events
            └─ crucible_*.js ↔ WASM exports
                 └─ WebGLBackend (VTable)
                      └─ Empire & Kin session_run + game + vehicle_phys
```

## Next Implementation Steps

1. Flesh out `web_backend.zig` so it can clear a canvas and draw a simple test mesh via WebGL2 (JS interop or pure WASM WebGL bindings).
2. Wire the real `session_run` and game modules from the submodule into the WASM build.
3. Map Empire & Kin controls (WASD, Shift handbrake, E enter/exit, etc.) cleanly.
4. Expose selected `PhysTuning` fields and vehicle state back to the React panel for live inspection/tuning.
5. Add frame-step, pause, and basic input recording/replay.

## Constraints Inherited from Empire & Kin

- CC0 / public-domain assets only
- Procedural fallback always present
- Pure Zig physics (no PhysX/Bullet)
- Keep entry points small; heavy logic lives in modules
