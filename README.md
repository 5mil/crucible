# Crucible

**Browser testing platform for [Empire & Kin](https://github.com/5mil/empire-and-kin)**

High-quality, fully client-side test harness that runs the entire game (vertical slice and beyond) at still-reasonable settings completely in the browser.

- Zig → WebAssembly
- WebGL backend implementing the same Backend VTable as desktop GL / Android GLES
- React + TypeScript test UI (input injection, physics tuning, telemetry, recording)
- Empire & Kin pulled in as a **git submodule**

## Quick Start

```bash
# 1. Clone this repo
git clone https://github.com/5mil/crucible.git
cd crucible

# 2. Pull Empire & Kin as submodule
git submodule update --init --recursive

# 3. Install web dependencies
cd web && npm install && cd ..

# 4. Build the WASM module (requires Zig 0.14)
zig build -Dweb=true -Doptimize=ReleaseFast

# 5. Run the browser tester
cd web && npm run dev
```

Open the printed localhost URL. The harness loads the WASM, maps keyboard/pointer to the game’s input layer, and exposes controls for vehicle physics, camera, and frame stepping.

## Architecture

```
crucible/
├── vendor/empire-and-kin/     # git submodule → 5mil/empire-and-kin
├── src/                       # Crucible-specific Zig (WASM entry + WebGL backend)
│   ├── main_web.zig
│   ├── web_backend.zig
│   └── web_exports.zig
├── web/                       # Vite + React + TypeScript host + test UI
├── build.zig
└── docs/
```

The game logic, raycast vehicle physics, scene, and asset continuum remain **identical** to the main repo. Only the host and graphics backend change.

## Goals

- Run the full playable slice (one district, mesh/procedural assets, weighty drive) in any modern browser
- Provide a robust testing surface: live `PhysTuning` sliders, vehicle type switcher, input recording/replay, metrics overlay, pause/step
- Keep the Backend VTable contract so desktop, Android GLES, and WebGL stay in lock-step
- Ship as a static site (GitHub Pages / Vercel / Cloudflare Pages)

## Requirements

- Zig 0.14
- Node 20+
- Modern browser with WebGL 2

## Status

Initial scaffold. WebGL backend and full WASM export surface are the next implementation targets.

## License

Same spirit as Empire & Kin (CC0 / public-domain assets only for game content). Code in this repo is MIT unless noted otherwise.
