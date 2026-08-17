//! WebGL backend that will implement the same Backend VTable contract
//! used by `gl_backend.zig` and `gles_backend.zig` in Empire & Kin.
//!
//! Goal: one game simulation, three hosts (desktop, Android, browser).
//!
//! This file is currently a placeholder. The real implementation will:
//! - Own the WebGL2 context (passed in from JS or created via Emscripten-style glue)
//! - Provide drawVehicle, drawMesh, drawHUD, etc. matching the VTable
//! - Support the asset continuum (procedural → textured → mesh)

const std = @import("std");

pub const WebGLBackend = struct {
    // TODO: context, programs, buffers, texture bank mirror, etc.

    pub fn init() !WebGLBackend {
        return .{};
    }

    pub fn deinit(self: *WebGLBackend) void {
        _ = self;
    }

    // Placeholder methods that will later match the real Backend VTable.
    pub fn beginFrame(self: *WebGLBackend) void {
        _ = self;
    }

    pub fn endFrame(self: *WebGLBackend) void {
        _ = self;
    }

    pub fn drawVehicle(
        self: *WebGLBackend,
        pos: [3]f32,
        yaw: f32,
        pitch: f32,
        roll: f32,
        wheel_spin: f32,
        steer: f32,
        health: f32,
        color: u32,
    ) void {
        _ = self;
        _ = pos;
        _ = yaw;
        _ = pitch;
        _ = roll;
        _ = wheel_spin;
        _ = steer;
        _ = health;
        _ = color;
    }
};
