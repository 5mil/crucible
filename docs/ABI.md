# Crucible WASM ABI

Current: **v6**

## Lifecycle
- `crucible_init(w, h)`
- `crucible_frame(dt)`
- `crucible_key(code, down)` / `crucible_pointer` / `crucible_resize` / `crucible_shutdown`
- `crucible_version()` → 6

## Metrics
- player x/z, yaw, speed, pitch, roll, in_vehicle, vtype, health
- heat, treasury, day, clock, respect, district (0/1/2)
- draw_calls, frame

## Scene entities (indexed)
- buildings, peds, traffic, vehicles, markers via `crucible_scene_*` counts + getters

## Persistence
- `crucible_load_state(district, on_foot, hp, heat, treasury, respect, day, clock, x, z, yaw)`
- Host saves JSON to localStorage; reloads via load_state

## Travel
- `crucible_travel(district)` or interact with orange travel markers in-world
