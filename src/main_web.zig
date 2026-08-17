//! Crucible — WASM entry point for the Empire & Kin browser tester.
//!
//! This file is the freestanding WASM root. It will eventually:
//! 1. Boot a WebGLBackend that implements the same Backend VTable
//!    used by desktop GL and Android GLES.
//! 2. Drive the real session_run / game loop from the Empire & Kin submodule.
//! 3. Export a minimal C ABI that the React host can call each frame.
//!
//! Current state: scaffold + export surface. Full game wiring comes next.

const std = @import("std");
const builtin = @import("builtin");

// Build options (set by build.zig)
const build_options = @import("build_options");

// ---------------------------------------------------------------------------
// Minimal exported surface for the JS host
// ---------------------------------------------------------------------------

/// Called once after the WASM module is instantiated.
export fn crucible_init(width: i32, height: i32) void {
    _ = width;
    _ = height;
    // TODO: create WebGLBackend, initialise session, load assets continuum
}

/// Called every animation frame. `dt` is seconds since last frame.
export fn crucible_frame(dt: f32) void {
    _ = dt;
    // TODO: pump input, run session_run step, draw via WebGLBackend
}

/// Keyboard / pointer state from the host.
export fn crucible_key(key: i32, down: i32) void {
    _ = key;
    _ = down;
}

export fn crucible_pointer(x: f32, y: f32, buttons: i32) void {
    _ = x;
    _ = y;
    _ = buttons;
}

export fn crucible_resize(width: i32, height: i32) void {
    _ = width;
    _ = height;
}

export fn crucible_shutdown() void {
    // TODO: tear down backend + session
}

// Simple heartbeat so the host can verify the module loaded.
export fn crucible_version() i32 {
    return 1; // increment as the ABI stabilises
}

// ---------------------------------------------------------------------------
// Native fallback (when not building for wasm)
// ---------------------------------------------------------------------------

pub fn main() void {
    if (builtin.os.tag == .freestanding) return;
    std.debug.print("Crucible native stub — build with -Dweb=true for WASM\n", .{});
}
