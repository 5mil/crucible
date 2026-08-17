//! Crucible — WASM entry for the Empire & Kin browser tester.
//!
//! Drives Backend VTable + Phase 5 vehicle_phys (ported drive slice).
//! Full session_run is still a stub upstream; when assembled, swap this
//! loop for the real session.

const std = @import("std");
const builtin = @import("builtin");
const web = @import("web_backend.zig");
const phys = @import("vehicle_phys_slice.zig");

var gfx: web.Backend = undefined;
var inited: bool = false;

var player_x: f32 = 0;
var player_z: f32 = 0;
var player_yaw: f32 = 0;
var on_foot: bool = true;
var vehicle: phys.Vehicle = .{};
var e_was_down: bool = false;
var f_was_down: bool = false;

export fn crucible_init(width: i32, height: i32) void {
    gfx = web.getBackend();
    gfx.init("Crucible", @intCast(@max(width, 1)), @intCast(@max(height, 1))) catch {
        return;
    };
    inited = true;
    player_x = 0;
    player_z = 0;
    player_yaw = 0;
    on_foot = true;
    vehicle = phys.spawn(.sedan, 4, 2);
    e_was_down = false;
    f_was_down = false;
}

export fn crucible_frame(dt: f32) void {
    if (!inited) return;
    const dtf: f64 = if (dt > 0 and dt < 0.25) @floatCast(dt) else 1.0 / 60.0;
    web.setDeltaTime(dtf);
    const d: f32 = @floatCast(dtf);

    gfx.beginFrame();
    const input = gfx.pollInput();

    const e_edge = input.interact and !e_was_down;
    e_was_down = input.interact;
    const f_edge = input.attack and !f_was_down;
    f_was_down = input.attack;

    if (f_edge and on_foot) {
        vehicle.vtype = switch (vehicle.vtype) {
            .sedan => .taxi,
            .taxi => .truck,
            .truck => .motorcycle,
            .motorcycle => .sedan,
        };
        const t = phys.tuningFor(vehicle.vtype);
        vehicle.body_y = t.rest_len;
        vehicle.max_speed = switch (vehicle.vtype) {
            .sedan => 16.0,
            .truck => 11.0,
            .motorcycle => 20.0,
            .taxi => 15.0,
        };
    }

    if (on_foot) {
        const speed: f32 = 6.0;
        player_x += input.move_x * speed * d;
        player_z += input.move_y * speed * d;
        if (input.move_x != 0 or input.move_y != 0) {
            player_yaw = std.math.atan2(input.move_y, input.move_x);
        }
        if (e_edge) {
            const dx = player_x - vehicle.x;
            const dz = player_z - vehicle.z;
            if (dx * dx + dz * dz < 16.0) {
                on_foot = false;
                vehicle.occupied = true;
                vehicle.yaw = player_yaw;
                web.in_vehicle_hint = true;
            }
        }
    } else {
        const mapped = phys.inputsFromMove(input.move_x, input.move_y);
        phys.integrate(&vehicle, mapped.throttle, mapped.steer, input.handbrake, dtf);
        player_x = vehicle.x;
        player_z = vehicle.z;
        player_yaw = vehicle.yaw;

        if (e_edge) {
            on_foot = true;
            vehicle.occupied = false;
            vehicle.vx = 0;
            vehicle.vz = 0;
            vehicle.yaw_rate = 0;
            vehicle.steer = 0;
            vehicle.speed = 0;
            web.in_vehicle_hint = false;
            player_x += @cos(vehicle.yaw + 1.57) * 1.5;
            player_z += @sin(vehicle.yaw + 1.57) * 1.5;
        }
    }

    const yaw = if (on_foot) player_yaw else vehicle.yaw;
    const cam_dist: f32 = if (on_foot) 14.0 else 16.0;
    const cam_height: f32 = if (on_foot) 10.0 else 12.0;
    gfx.setCamera(.{
        .position = .{
            .x = player_x - @cos(yaw) * cam_dist,
            .y = cam_height,
            .z = player_z - @sin(yaw) * cam_dist,
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

    const body_y = if (vehicle.occupied) vehicle.body_y else phys.tuningFor(vehicle.vtype).rest_len;
    _ = gfx.drawVehicle(
        .{ .x = vehicle.x, .y = body_y, .z = vehicle.z },
        vehicle.yaw,
        if (vehicle.occupied) vehicle.pitch else 0,
        if (vehicle.occupied) vehicle.roll else 0,
        vehicle.wheel_spin,
        vehicle.steer,
        vehicle.health,
        web.Color.rgb(180, 40, 40),
    );

    if (on_foot) {
        gfx.drawPlayerProxy(.{ .x = player_x, .y = 0, .z = player_z }, player_yaw, web.Color.rgb(80, 180, 120));
    }

    gfx.drawText("CRUCIBLE · Phase 5 phys", 12, 20, web.Color.rgb(201, 162, 39));
    if (on_foot) {
        gfx.drawText("WASD walk  E enter  F cycle type", 12, 44, web.Color.rgb(180, 190, 200));
    } else {
        gfx.drawText("WASD drive  Shift handbrake  E exit", 12, 44, web.Color.rgb(200, 200, 210));
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
    return 4;
}

export fn crucible_metric_player_x() f32 {
    return player_x;
}
export fn crucible_metric_player_z() f32 {
    return player_z;
}
export fn crucible_metric_yaw() f32 {
    return if (on_foot) player_yaw else vehicle.yaw;
}
export fn crucible_metric_speed() f32 {
    return if (on_foot) 0 else vehicle.speed;
}
export fn crucible_metric_in_vehicle() i32 {
    return if (on_foot) 0 else 1;
}
export fn crucible_metric_draw_calls() i32 {
    return @intCast(web.getDrawCalls());
}
export fn crucible_metric_frame() i32 {
    return @intCast(web.getFrameCount());
}
export fn crucible_metric_pitch() f32 {
    return if (on_foot) 0 else vehicle.pitch;
}
export fn crucible_metric_roll() f32 {
    return if (on_foot) 0 else vehicle.roll;
}
export fn crucible_metric_vtype() i32 {
    return @intFromEnum(vehicle.vtype);
}
export fn crucible_metric_health() i32 {
    return vehicle.health;
}

export fn crucible_cam_px() f32 {
    const yaw = if (on_foot) player_yaw else vehicle.yaw;
    return player_x - @cos(yaw) * 16.0;
}
export fn crucible_cam_py() f32 {
    return 12.0;
}
export fn crucible_cam_pz() f32 {
    const yaw = if (on_foot) player_yaw else vehicle.yaw;
    return player_z - @sin(yaw) * 16.0;
}
export fn crucible_cam_tx() f32 {
    return player_x;
}
export fn crucible_cam_ty() f32 {
    return 1.0;
}
export fn crucible_cam_tz() f32 {
    return player_z;
}

pub fn main() void {
    if (builtin.os.tag == .freestanding) return;
    std.debug.print("Crucible — Phase 5 vehicle_phys slice (ABI v4)\n", .{});
}
