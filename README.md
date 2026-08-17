# Crucible

Browser testing platform for **Empire & Kin** — full vertical-slice playable in WebGL.

## What you get (ABI v5)

- **Little Italy** district: 24 buildings, streets, day/night sky
- **Phase 5 vehicle physics** (sedan / taxi / truck / motorcycle)
- Walk, enter/exit cars, handbrake slides, body pitch/roll
- **16 pedestrians**, traffic loop, mission / racket / safehouse / vendor markers
- Economy (treasury, respect), heat from speeding, day clock
- React harness with live metrics + WebGL2 host renderer

## Build

```bash
git clone https://github.com/5mil/crucible.git && cd crucible
# optional: git submodule update --init
zig build -Dweb=true -Doptimize=ReleaseFast
# wasm lands in zig-out or web/public — copy to web/public/crucible.wasm
cd web && npm i && npm run dev
```

Requires **Zig 0.14**.

## Controls

| Key | Action |
|-----|--------|
| WASD | Walk / drive |
| E | Enter nearest car · exit · interact with marker |
| F | Cycle vehicle type (on foot) |
| H | Heal |
| Shift | Handbrake |

## Architecture

Zig WASM session → metrics + entity exports → JS WebGL2 draws the world.

Upstream `session_run` in empire-and-kin is still a stub; Crucible ships a complete playable slice until that is assembled.

## License

CC0 / public-domain assets only. Code follows the same spirit as Empire & Kin.
