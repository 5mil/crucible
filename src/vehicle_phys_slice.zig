//! Crucible drive slice — Phase 5 raycast vehicle physics from Empire & Kin.
//! Ported for freestanding WASM (no city collision dependency).
//! Source of truth remains 5mil/empire-and-kin src/game/vehicle_phys.zig.

const std = @import("std");

pub const VehicleType = enum {
    sedan,
    truck,
    motorcycle,
    taxi,
};

pub const Vehicle = struct {
    vtype: VehicleType = .sedan,
    x: f32 = 0,
    z: f32 = 0,
    speed: f32 = 0,
    max_speed: f32 = 16,
    health: u8 = 100,
    occupied: bool = false,
    yaw: f32 = 0,
    wheel_spin: f32 = 0,
    steer: f32 = 0,
    vx: f32 = 0,
    vz: f32 = 0,
    yaw_rate: f32 = 0,
    body_y: f32 = 0.42,
    vy: f32 = 0,
    pitch: f32 = 0,
    roll: f32 = 0,
};

pub const PhysTuning = struct {
    mass: f32,
    power: f32,
    brake_force: f32,
    max_steer: f32,
    grip: f32,
    drag: f32,
    rolling_resist: f32,
    spring_k: f32,
    damper_c: f32,
    rest_len: f32,
    max_travel: f32,
    wheelbase: f32,
    track: f32,
    cg_height: f32,
    yaw_inertia: f32,
    assist: f32,
};

pub fn tuningFor(vtype: VehicleType) PhysTuning {
    return switch (vtype) {
        .sedan => .{
            .mass = 1200,
            .power = 9200,
            .brake_force = 14000,
            .max_steer = 0.55,
            .grip = 1.05,
            .drag = 0.42,
            .rolling_resist = 180,
            .spring_k = 28000,
            .damper_c = 3200,
            .rest_len = 0.42,
            .max_travel = 0.28,
            .wheelbase = 2.1,
            .track = 1.5,
            .cg_height = 0.55,
            .yaw_inertia = 1800,
            .assist = 0.55,
        },
        .taxi => .{
            .mass = 1250,
            .power = 8800,
            .brake_force = 13500,
            .max_steer = 0.52,
            .grip = 1.0,
            .drag = 0.45,
            .rolling_resist = 190,
            .spring_k = 27000,
            .damper_c = 3100,
            .rest_len = 0.42,
            .max_travel = 0.28,
            .wheelbase = 2.15,
            .track = 1.5,
            .cg_height = 0.55,
            .yaw_inertia = 1900,
            .assist = 0.5,
        },
        .truck => .{
            .mass = 2800,
            .power = 11000,
            .brake_force = 20000,
            .max_steer = 0.42,
            .grip = 0.85,
            .drag = 0.7,
            .rolling_resist = 320,
            .spring_k = 42000,
            .damper_c = 4800,
            .rest_len = 0.55,
            .max_travel = 0.35,
            .wheelbase = 2.6,
            .track = 1.85,
            .cg_height = 0.85,
            .yaw_inertia = 4500,
            .assist = 0.4,
        },
        .motorcycle => .{
            .mass = 220,
            .power = 6500,
            .brake_force = 5000,
            .max_steer = 0.7,
            .grip = 1.15,
            .drag = 0.28,
            .rolling_resist = 40,
            .spring_k = 12000,
            .damper_c = 900,
            .rest_len = 0.38,
            .max_travel = 0.22,
            .wheelbase = 1.4,
            .track = 0.05,
            .cg_height = 0.5,
            .yaw_inertia = 120,
            .assist = 0.35,
        },
    };
}

const WheelLayout = struct {
    fl: [3]f32 = .{ -0.75, 0.28, 1.05 },
    fr: [3]f32 = .{ 0.75, 0.28, 1.05 },
    rl: [3]f32 = .{ -0.75, 0.28, -1.05 },
    rr: [3]f32 = .{ 0.75, 0.28, -1.05 },
    radius: f32 = 0.32,
};

fn wheelsFor(vtype: VehicleType) WheelLayout {
    return switch (vtype) {
        .sedan, .taxi => .{},
        .truck => .{
            .fl = .{ -0.95, 0.35, 1.35 },
            .fr = .{ 0.95, 0.35, 1.35 },
            .rl = .{ -0.95, 0.35, -1.25 },
            .rr = .{ 0.95, 0.35, -1.25 },
            .radius = 0.38,
        },
        .motorcycle => .{
            .fl = .{ 0.0, 0.32, 0.85 },
            .fr = .{ 0.0, 0.32, 0.85 },
            .rl = .{ 0.0, 0.32, -0.85 },
            .rr = .{ 0.0, 0.32, -0.85 },
            .radius = 0.30,
        },
    };
}

pub fn spawn(vtype: VehicleType, x: f32, z: f32) Vehicle {
    const max_spd: f32 = switch (vtype) {
        .sedan => 16.0,
        .truck => 11.0,
        .motorcycle => 20.0,
        .taxi => 15.0,
    };
    const rest = tuningFor(vtype).rest_len;
    return .{
        .vtype = vtype,
        .x = x,
        .z = z,
        .max_speed = max_spd,
        .body_y = rest,
        .health = 100,
    };
}

pub fn integrate(v: *Vehicle, throttle: f32, steer_in: f32, handbrake: bool, dt64: f64) void {
    if (!v.occupied) return;
    const dt: f32 = @floatCast(dt64);
    if (dt <= 0 or dt > 0.1) return;

    const t = tuningFor(v.vtype);
    const wl = wheelsFor(v.vtype);

    const speed = @sqrt(v.vx * v.vx + v.vz * v.vz);
    const speed_factor = 1.0 / (1.0 + speed * 0.08);
    const target_steer = std.math.clamp(steer_in, -1.0, 1.0) * t.max_steer * speed_factor;
    v.steer += (target_steer - v.steer) * @min(1.0, 10.0 * dt);

    const cy = @cos(v.yaw);
    const sy = @sin(v.yaw);
    const fwd_x = cy;
    const fwd_z = sy;
    const right_x = -sy;
    const right_z = cy;

    const v_long = v.vx * fwd_x + v.vz * fwd_z;
    const v_lat = v.vx * right_x + v.vz * right_z;

    var f_long: f32 = 0;
    const thr = std.math.clamp(throttle, -1.0, 1.0);
    if (thr > 0.05) {
        const fade = @max(0.15, 1.0 - speed / (v.max_speed * 1.15));
        f_long += thr * t.power * fade;
    } else if (thr < -0.05) {
        f_long += thr * t.brake_force;
    }
    if (@abs(thr) < 0.08 and speed > 0.5) {
        f_long -= std.math.sign(v_long) * t.rolling_resist * 0.6;
    }
    f_long -= std.math.sign(v_long) * t.rolling_resist;
    f_long -= t.drag * v_long * @abs(v_long);

    var rear_grip = t.grip;
    var front_grip = t.grip;
    if (handbrake) {
        rear_grip *= 0.28;
        front_grip *= 1.05;
    }
    const max_lat_f = t.mass * 9.81 * ((front_grip + rear_grip) * 0.5);
    var f_lat = -v_lat * t.mass * 8.0 * ((front_grip + rear_grip) * 0.5);
    f_lat = std.math.clamp(f_lat, -max_lat_f, max_lat_f);

    const steer_yaw = v.steer * (0.6 + t.assist) * (1.0 + speed * 0.15);
    const oversteer = if (handbrake) v_lat * 0.35 else v_lat * 0.05;
    var yaw_accel = (steer_yaw * speed * 0.55 - oversteer * 2.5 - v.yaw_rate * 2.2) / (t.yaw_inertia / t.mass);
    yaw_accel = std.math.clamp(yaw_accel, -8.0, 8.0);

    const fx = fwd_x * f_long + right_x * f_lat;
    const fz = fwd_z * f_long + right_z * f_lat;

    v.vx += (fx / t.mass) * dt;
    v.vz += (fz / t.mass) * dt;
    v.yaw_rate += yaw_accel * dt;
    v.yaw_rate *= @max(0.0, 1.0 - 1.8 * dt);
    v.yaw += v.yaw_rate * dt;
    if (v.yaw > std.math.pi) v.yaw -= 2.0 * std.math.pi;
    if (v.yaw < -std.math.pi) v.yaw += 2.0 * std.math.pi;

    const mounts = [_][2]f32{
        .{ wl.fl[0], wl.fl[2] },
        .{ wl.fr[0], wl.fr[2] },
        .{ wl.rl[0], wl.rl[2] },
        .{ wl.rr[0], wl.rr[2] },
    };
    var spring_force_total: f32 = 0;
    var pitch_torque: f32 = 0;
    var roll_torque: f32 = 0;
    var grounded_n: f32 = 0;
    var wi: usize = 0;
    while (wi < 4) : (wi += 1) {
        const local_x = mounts[wi][0];
        const local_z = mounts[wi][1];
        const mount_y = v.body_y + t.rest_len;
        const ground_y: f32 = 0.0;
        const ray_hit = mount_y - ground_y;
        const compression = std.math.clamp(t.rest_len + t.max_travel - ray_hit, 0.0, t.max_travel + t.rest_len);
        const grounded = ray_hit < (t.rest_len + t.max_travel);
        if (grounded) {
            grounded_n += 1;
            const spring_f = compression * t.spring_k;
            const damp_f = -v.vy * t.damper_c;
            const f = spring_f + damp_f;
            spring_force_total += f;
            pitch_torque += f * local_z;
            roll_torque += f * (-local_x);
        }
    }
    if (grounded_n > 0) {
        v.vy += ((spring_force_total / t.mass) - 9.81) * dt;
    } else {
        v.vy -= 9.81 * dt;
    }
    v.body_y += v.vy * dt;
    if (v.body_y < 0.05) {
        v.body_y = 0.05;
        if (v.vy < 0) v.vy = 0;
    }
    if (v.body_y > t.rest_len + t.max_travel) {
        v.body_y = t.rest_len + t.max_travel;
        if (v.vy > 0) v.vy *= 0.3;
    }

    const target_pitch = std.math.clamp(
        -pitch_torque / (t.mass * 40.0) - thr * 0.04 + (if (thr < -0.3) @as(f32, -0.06) else @as(f32, 0.0)),
        -0.18,
        0.14,
    );
    const target_roll = std.math.clamp(roll_torque / (t.mass * 35.0) + v.yaw_rate * 0.08, -0.22, 0.22);
    v.pitch += (target_pitch - v.pitch) * @min(1.0, 8.0 * dt);
    v.roll += (target_roll - v.roll) * @min(1.0, 8.0 * dt);

    v.x += v.vx * dt;
    v.z += v.vz * dt;

    const bound: f32 = 55;
    if (v.x > bound or v.x < -bound) {
        v.x = std.math.clamp(v.x, -bound, bound);
        v.vx *= -0.3;
    }
    if (v.z > bound or v.z < -bound) {
        v.z = std.math.clamp(v.z, -bound, bound);
        v.vz *= -0.3;
    }

    v.speed = @sqrt(v.vx * v.vx + v.vz * v.vz);
    if (v.speed > v.max_speed * 1.2) {
        const s = (v.max_speed * 1.2) / v.speed;
        v.vx *= s;
        v.vz *= s;
        v.speed = v.max_speed * 1.2;
    }
    v.wheel_spin += (v_long / wl.radius) * dt;
}

pub fn inputsFromMove(move_x: f32, move_y: f32) struct { throttle: f32, steer: f32 } {
    return .{
        .throttle = std.math.clamp(move_y, -1.0, 1.0),
        .steer = std.math.clamp(move_x, -1.0, 1.0),
    };
}
