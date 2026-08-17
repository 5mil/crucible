//! Crucible — WASM entry for the Empire & Kin browser tester.
//!
//! Exports a stable C ABI for the React host. Internally drives a
//! Backend-VTable-compatible Web backend and a minimal demo loop that
//! exercises input → camera → draw path (player proxy + ground + vehicle).
//!
//! When the empire-and-kin submodule is linked, replace the demo loop
//! with the real session_run.

const std = @import("std");
const builtin = @import("builtin");
const web = @import("web_backend.zig");

var gfx: web.Backend = undefined;
var inited: bool = false;

// Demo world (stand-in until full session is linked)
var player_x: f32 = 0;
var player_z: f32 = 0;
var player_yaw: f32 = 0;
var in_vehicle: bool = false;
var veh_vx: f32 = 0;
var veh_vz: f32 = 0;
var veh_yaw: f32 = 0;
var veh_pitch: f32 = 0;
var veh_roll: f32 = 0;
var wheel_spin: f32 = 0;
var e_was_down: bool = false;

export fn crucible_init(width: i32, height: i32) void {
    gfx = web.getBackend();
    gfx.init("Crucible", @intCast(@max(width, 1)), @intCast(@max(height, 1))) catch {
        return;
    };
    inited = true;
    player_x = 0;
    player_z = 0;
    player_yaw = 0;
    in_vehicle = false;
    veh_vx = 0;
    veh_vz = 0;
    veh_yaw = 0;
    veh_pitch = 0;
    veh_roll = 0;
    e_was_down = false;
}

export fn crucible_frame(dt: f32) void {
    if (!inited) return;
    const dtf: f64 = if (dt > 0 and dt < 0.25) @floatCast(dt) else 1.0 / 60.0;
    web.setDeltaTime(dtf);
    const d: f32 = @floatCast(dtf);

    gfx.beginFrame();
    const input = gfx.pollInput();

    // Edge-trigger E for enter/exit
    const e_edge = input.interact and !e_was_down;
    e_was_down = input.interact;

    if (!in_vehicle) {
        const speed: f32 = 6.0;
        player_x += input.move_x * speed * d;
        player_z += input.move_y * speed * d;
        if (input.move_x != 0 or input.move_y != 0) {
            player_yaw = std.math.atan2(input.move_x, input.move_y);
        }
        if (e_edge) {
            in_vehicle = true;
            veh_yaw = player_yaw;
            web.in_vehicle_hint = true;
        }
    } else {
        const throttle = input.move_y;
        const steer = input.move_x;
        const accel: f32 = if (input.handbrake) 4.0 else 12.0;
        const drag: f32 = if (input.handbrake) 0.92 else 0.98;

        const forward_x = @sin(veh_yaw);
        const forward_z = @cos(veh_yaw);
        veh_vx += forward_x * throttle * accel * d;
        veh_vz += forward_z * throttle * accel * d;
        veh_vx *= drag;
        veh_vz *= drag;

        const speed = @sqrt(veh_vx * veh_vx + veh_vz * veh_vz);
        if (speed > 0.5) {
            veh_yaw += steer * 1.8 * d * @min(speed / 8.0, 1.0);
            if (input.handbrake) {
                veh_yaw += steer * 2.5 * d;
                veh_roll = std.math.clamp(veh_roll + steer * 0.8 * d, -0.35, 0.35);
            } else {
                veh_roll *= 0.9;
            }
        } else {
            veh_roll *= 0.9;
        }
        veh_pitch = std.math.clamp(throttle * 0.08, -0.12, 0.12);
        wheel_spin += speed * 4.0 * d;

        player_x += veh_vx * d;
        player_z += veh_vz * d;

        if (e_edge) {
            in_vehicle = false;
            veh_vx = 0;
            veh_vz = 0;
            web.in_vehicle_hint = false;
        }
    }

    const yaw = if (in_vehicle) veh_yaw else player_yaw;
    const cam_dist: f32 = 16;
    const cam_height: f32 = 12;
    gfx.setCamera(.{
        .position = .{
            .x = player_x - @sin(yaw) * cam_dist,
            .y = cam_height,
            .z = player_z - @cos(yaw) * cam_dist,
        },
        .target = .{ .x = player_x, .y = 1, .z = player_z },
        .up = .{ .x = 0, .y = 1, .z = 0 },
        .fov_deg = 55,
    });

    gfx.clear(web.Color.rgb(24, 28, 36));
    gfx.drawGround(80, web.Color.rgb(40, 48, 42));
    _ = gfx.drawBuilding(.{ .x = 12, .y = 0, .z = 8 }, 6, 10, 6, web.Color.rgb(90, 70, 60));
    _ = gfx.drawBuilding(.{ .x = -14, .y = 0, .z = 10 }, 5, 14, 5, web.Color.rgb(70, 75, 90));
    _ = gfx.drawBuilding(.{ .x = 8, .y = 0, .z = -12 }, 8, 8, 7, web.Color.rgb(100, 85, 70));

    if (in_vehicle) {
        _ = gfx.drawVehicle(
            .{ .x = player_x, .y = 0.5, .z = player_z },
            veh_yaw,
            veh_pitch,
            veh_roll,
            wheel_spin,
            0,
            100,
            web.Color.rgb(180, 40, 40),
        );
    } else {
        gfx.drawPlayerProxy(.{ .x = player_x, .y = 0, .z = player_z }, player_yaw, web.Color.rgb(80, 180, 120));
    }

    gfx.drawText("CRUCIBLE", 12, 20, web.Color.rgb(201, 162, 39));
    if (in_vehicle) {
        gfx.drawText("IN VEHICLE  Shift=handbrake  E=exit", 12, 44, web.Color.rgb(200, 200, 210));
    } else {
        gfx.drawText("WASD move  E=enter vehicle", 12, 44, web.Color.rgb(180, 190, 200));
    }

    gfx.endFrame();
}

export fn crucible_key(key: i32, down: i32) void {
    web.setKey(key, down != 0);
}

export fn crucible_pointer(x: f32, y: f32, buttons: i32) void {
    web.setPointer(x, y, buttons);
}

export fn crucible_resize(width: i32, height: i32) void {
    web.setSize(@intCast(@max(width, 1)), @intCast(@max(height, 1)));
}

export fn crucible_shutdown() void {
    if (inited) {
        gfx.shutdown();
        inited = false;
    }
}

export fn crucible_version() i32 {
    return 2;
}

export fn crucible_metric_player_x() f32 {
    return player_x;
}
export fn crucible_metric_player_z() f32 {
    return player_z;
}
export fn crucible_metric_yaw() f32 {
    return if (in_vehicle) veh_yaw else player_yaw;
}
export fn crucible_metric_speed() f32 {
    if (!in_vehicle) return 0;
    return @sqrt(veh_vx * veh_vx + veh_vz * veh_vz);
}
export fn crucible_metric_in_vehicle() i32 {
    return if (in_vehicle) 1 else 0;
}
export fn crucible_metric_draw_calls() i32 {
    return @intCast(web.getDrawCalls());
}
export fn crucible_metric_frame() i32 {
    return @intCast(web.getFrameCount());
}

pub fn main() void {
    if (builtin.os.tag == .freestanding) return;
    std.debug.print("Crucible — build with -Dweb=true for WASM (ABI v2 demo loop)\n", .{});
}
