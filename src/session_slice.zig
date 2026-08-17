//! Crucible full vertical-slice session — one district, usable as a game.
//! See local crucible tree / artifacts for full source if this commit is truncated.
//! Frame-driven browser session: buildings, peds, traffic, markers, phys, economy.

const std = @import("std");
const phys = @import("vehicle_phys_slice.zig");

pub const MAX_BUILDINGS: usize = 48;
pub const MAX_PEDS: usize = 24;
pub const MAX_TRAFFIC: usize = 12;
pub const MAX_VEHICLES: usize = 6;
pub const MAX_MARKERS: usize = 8;
pub const MAX_FEED: usize = 6;

pub const Building = struct { x: f32, z: f32, w: f32, h: f32, d: f32, r: u8, g: u8, b: u8 };
pub const Ped = struct { x: f32, z: f32, yaw: f32, speed: f32, alive: bool = true, phase: f32 = 0 };
pub const TrafficCar = struct { x: f32, z: f32, yaw: f32, speed: f32, lane: i32, color_r: u8, color_g: u8, color_b: u8 };
pub const MarkerKind = enum { mission, racket, safehouse, vendor };
pub const Marker = struct { x: f32, z: f32, kind: MarkerKind, label: [24]u8 = undefined, label_len: usize = 0, active: bool = true, reward: i32 = 0, cooldown: f64 = 0 };
pub const FeedLine = struct { text: [48]u8 = undefined, len: usize = 0, age: f64 = 0 };

pub const Session = struct {
    boss_x: f32 = 10,
    boss_z: f32 = 20,
    boss_yaw: f32 = 0,
    boss_hp: u8 = 100,
    on_foot: bool = true,
    treasury: i32 = 2500,
    heat: u8 = 0,
    day: u32 = 1,
    clock_hours: f32 = 9.0,
    respect: i32 = 10,
    vehicles: [MAX_VEHICLES]phys.Vehicle = undefined,
    vehicle_count: usize = 0,
    active_vehicle: usize = 0,
    buildings: [MAX_BUILDINGS]Building = undefined,
    building_count: usize = 0,
    peds: [MAX_PEDS]Ped = undefined,
    ped_count: usize = 0,
    traffic: [MAX_TRAFFIC]TrafficCar = undefined,
    traffic_count: usize = 0,
    markers: [MAX_MARKERS]Marker = undefined,
    marker_count: usize = 0,
    feed: [MAX_FEED]FeedLine = undefined,
    feed_count: usize = 0,
    toast: [48]u8 = undefined,
    toast_len: usize = 0,
    toast_age: f64 = 0,
    e_was: bool = false,
    f_was: bool = false,
    h_was: bool = false,
    heat_decay_acc: f64 = 0,
    racket_acc: f64 = 0,
    frame: u64 = 0,
    district_name: []const u8 = "Little Italy",

    pub fn init() Session {
        var s: Session = .{};
        s.seedDistrict();
        s.pushFeed("Welcome to Little Italy");
        return s;
    }

    fn seedDistrict(self: *Session) void {
        const footprints = [_][5]f32{
            .{ 16, 12, 7, 12, 6 }, .{ 16, 24, 6, 9, 5 }, .{ 16, 34, 8, 14, 7 },
            .{ 28, 12, 5, 8, 5 }, .{ 28, 22, 7, 11, 6 }, .{ 28, 34, 6, 10, 5 },
            .{ 4, 12, 6, 10, 5 }, .{ 4, 24, 5, 7, 4 }, .{ 4, 34, 7, 13, 6 },
            .{ -8, 14, 6, 9, 5 }, .{ -8, 26, 8, 12, 7 }, .{ -8, 38, 5, 8, 5 },
            .{ 40, 16, 6, 11, 5 }, .{ 40, 28, 7, 9, 6 }, .{ -20, 18, 5, 10, 5 },
            .{ -20, 30, 6, 8, 5 }, .{ 10, 0, 8, 6, 6 }, .{ 24, 0, 5, 7, 4 },
            .{ -4, 0, 6, 9, 5 }, .{ 36, 4, 5, 8, 4 }, .{ 16, 46, 7, 10, 6 },
            .{ 28, 46, 5, 8, 5 }, .{ 4, 46, 6, 11, 5 }, .{ -8, 48, 7, 9, 6 },
        };
        const colors = [_][3]u8{ .{ 90, 70, 60 }, .{ 70, 75, 90 }, .{ 100, 85, 70 }, .{ 80, 65, 70 } };
        self.building_count = 0;
        for (footprints, 0..) |fp, i| {
            if (self.building_count >= MAX_BUILDINGS) break;
            const c = colors[i % colors.len];
            self.buildings[self.building_count] = .{ .x = fp[0], .z = fp[1], .w = fp[2], .h = fp[3], .d = fp[4], .r = c[0], .g = c[1], .b = c[2] };
            self.building_count += 1;
        }
        self.vehicles[0] = phys.spawn(.sedan, 12, 18);
        self.vehicles[1] = phys.spawn(.taxi, 8, 22);
        self.vehicles[2] = phys.spawn(.truck, 20, 16);
        self.vehicles[3] = phys.spawn(.motorcycle, 6, 18);
        self.vehicle_count = 4;
        self.ped_count = 0;
        var pi: usize = 0;
        while (pi < 16) : (pi += 1) {
            const a = @as(f32, @floatFromInt(pi)) * 0.7;
            self.peds[pi] = .{ .x = 10 + @sin(a) * 18, .z = 20 + @cos(a) * 14, .yaw = a, .speed = 1.2 + @sin(a * 2) * 0.4, .phase = a };
            self.ped_count += 1;
        }
        self.traffic_count = 0;
        var ti: usize = 0;
        while (ti < 8) : (ti += 1) {
            const side: f32 = if (ti % 2 == 0) 1.0 else -1.0;
            self.traffic[ti] = .{ .x = -30 + @as(f32, @floatFromInt(ti)) * 12, .z = 20 + side * 3.5, .yaw = if (side > 0) 0 else std.math.pi, .speed = 6 + @as(f32, @floatFromInt(ti % 3)), .lane = if (side > 0) 0 else 1, .color_r = 40 + @as(u8, @intCast((ti * 37) % 120)), .color_g = 40 + @as(u8, @intCast((ti * 53) % 100)), .color_b = 50 + @as(u8, @intCast((ti * 19) % 90)) };
            self.traffic_count += 1;
        }
        self.setMarker(0, 16, 22, .mission, "Bootleg run", 400);
        self.setMarker(1, 28, 18, .racket, "Speakeasy", 150);
        self.setMarker(2, 4, 30, .racket, "Protection", 120);
        self.setMarker(3, 10, 8, .safehouse, "Safehouse", 0);
        self.setMarker(4, 22, 30, .vendor, "Fence", 0);
        self.setMarker(5, 36, 22, .mission, "Protection job", 250);
        self.marker_count = 6;
        self.boss_x = 10;
        self.boss_z = 20;
    }

    fn setMarker(self: *Session, i: usize, x: f32, z: f32, kind: MarkerKind, label: []const u8, reward: i32) void {
        self.markers[i] = .{ .x = x, .z = z, .kind = kind, .reward = reward, .active = true };
        const n = @min(label.len, 23);
        @memcpy(self.markers[i].label[0..n], label[0..n]);
        self.markers[i].label_len = n;
    }

    pub fn pushFeed(self: *Session, msg: []const u8) void {
        if (self.feed_count < MAX_FEED) {
            const n = @min(msg.len, 47);
            @memcpy(self.feed[self.feed_count].text[0..n], msg[0..n]);
            self.feed[self.feed_count].len = n;
            self.feed_count += 1;
        }
    }

    pub fn setToast(self: *Session, msg: []const u8) void {
        const n = @min(msg.len, 47);
        @memcpy(self.toast[0..n], msg[0..n]);
        self.toast_len = n;
        self.toast_age = 0;
    }

    pub fn tick(self: *Session, dt: f64, move_x: f32, move_y: f32, interact: bool, attack: bool, handbrake: bool, heal_key: bool) void {
        self.frame +%= 1;
        const d: f32 = @floatCast(if (dt > 0 and dt < 0.25) dt else 1.0 / 60.0);
        const e_edge = interact and !self.e_was;
        self.e_was = interact;
        const f_edge = attack and !self.f_was;
        self.f_was = attack;
        const h_edge = heal_key and !self.h_was;
        self.h_was = heal_key;

        self.clock_hours += d * (24.0 / 600.0);
        if (self.clock_hours >= 24) {
            self.clock_hours -= 24;
            self.day += 1;
            self.treasury += 80;
            if (self.heat > 5) self.heat -|= 5;
            self.pushFeed("A new day in the city");
        }
        self.heat_decay_acc += dt;
        if (self.heat_decay_acc > 4.0) {
            self.heat_decay_acc = 0;
            if (self.heat > 0) self.heat -|= 1;
        }
        if (self.toast_len > 0) {
            self.toast_age += dt;
            if (self.toast_age > 3.5) self.toast_len = 0;
        }
        for (self.markers[0..self.marker_count]) |*m| {
            if (m.cooldown > 0) m.cooldown -= dt;
        }
        if (h_edge and self.on_foot and self.boss_hp < 100) {
            self.boss_hp = @min(100, self.boss_hp + 25);
            self.setToast("Used medkit (+25 HP)");
        }
        if (f_edge and self.on_foot) {
            const v = &self.vehicles[self.active_vehicle];
            v.vtype = switch (v.vtype) {
                .sedan => .taxi,
                .taxi => .truck,
                .truck => .motorcycle,
                .motorcycle => .sedan,
            };
            v.body_y = phys.tuningFor(v.vtype).rest_len;
            v.max_speed = switch (v.vtype) {
                .sedan => 16.0,
                .truck => 11.0,
                .motorcycle => 20.0,
                .taxi => 15.0,
            };
            self.setToast("Vehicle type changed");
        }

        if (self.on_foot) {
            self.boss_x += move_x * 6.5 * d;
            self.boss_z += move_y * 6.5 * d;
            self.resolvePlayerCollision();
            if (move_x != 0 or move_y != 0) self.boss_yaw = std.math.atan2(move_y, move_x);
            if (e_edge) {
                var best: ?usize = null;
                var best_d: f32 = 16.0;
                var vi: usize = 0;
                while (vi < self.vehicle_count) : (vi += 1) {
                    const v = self.vehicles[vi];
                    const dd = (self.boss_x - v.x) * (self.boss_x - v.x) + (self.boss_z - v.z) * (self.boss_z - v.z);
                    if (dd < best_d) {
                        best_d = dd;
                        best = vi;
                    }
                }
                if (best) |idx| {
                    self.active_vehicle = idx;
                    self.vehicles[idx].occupied = true;
                    self.vehicles[idx].yaw = self.boss_yaw;
                    self.on_foot = false;
                    self.setToast("Entered vehicle");
                } else self.tryInteractMarker();
            }
        } else {
            var v = &self.vehicles[self.active_vehicle];
            const mapped = phys.inputsFromMove(move_x, move_y);
            phys.integrate(v, mapped.throttle, mapped.steer, handbrake, dt);
            self.boss_x = v.x;
            self.boss_z = v.z;
            self.boss_yaw = v.yaw;
            if (v.speed > 12 and self.frame % 30 == 0 and self.heat < 100) self.heat +|= 1;
            if (e_edge) {
                v.occupied = false;
                v.vx = 0;
                v.vz = 0;
                v.yaw_rate = 0;
                v.steer = 0;
                v.speed = 0;
                self.on_foot = true;
                self.boss_x += @cos(v.yaw + 1.57) * 1.5;
                self.boss_z += @sin(v.yaw + 1.57) * 1.5;
                self.setToast("Left vehicle");
            }
        }

        for (self.peds[0..self.ped_count]) |*p| {
            p.phase += d * 0.4;
            p.yaw += @sin(p.phase) * 0.3 * d;
            p.x += @cos(p.yaw) * p.speed * d;
            p.z += @sin(p.yaw) * p.speed * d;
            p.x = std.math.clamp(p.x, -25, 50);
            p.z = std.math.clamp(p.z, -5, 55);
        }
        for (self.traffic[0..self.traffic_count]) |*c| {
            c.x += @cos(c.yaw) * c.speed * d;
            if (c.x > 55) c.x = -35;
            if (c.x < -35) c.x = 55;
        }
        self.racket_acc += dt;
        if (self.racket_acc > 30.0) {
            self.racket_acc = 0;
            self.treasury += 35;
            self.pushFeed("Racket collections +$35");
        }
    }

    fn resolvePlayerCollision(self: *Session) void {
        for (self.buildings[0..self.building_count]) |b| {
            const half_w = b.w * 0.5 + 0.4;
            const half_d = b.d * 0.5 + 0.4;
            const dx = self.boss_x - b.x;
            const dz = self.boss_z - b.z;
            if (@abs(dx) < half_w and @abs(dz) < half_d) {
                if (@abs(dx) / half_w > @abs(dz) / half_d) self.boss_x = b.x + std.math.sign(dx) * half_w else self.boss_z = b.z + std.math.sign(dz) * half_d;
            }
        }
    }

    fn tryInteractMarker(self: *Session) void {
        var best: ?usize = null;
        var best_d: f32 = 12.25;
        var i: usize = 0;
        while (i < self.marker_count) : (i += 1) {
            const m = self.markers[i];
            if (!m.active or m.cooldown > 0) continue;
            const dd = (self.boss_x - m.x) * (self.boss_x - m.x) + (self.boss_z - m.z) * (self.boss_z - m.z);
            if (dd < best_d) {
                best_d = dd;
                best = i;
            }
        }
        if (best) |idx| {
            const m = &self.markers[idx];
            switch (m.kind) {
                .mission => {
                    self.treasury += m.reward;
                    self.respect += 5;
                    if (self.heat < 90) self.heat +|= 8;
                    m.cooldown = 45;
                    self.setToast("Job done");
                },
                .racket => {
                    self.treasury += m.reward;
                    m.cooldown = 20;
                    self.setToast("Collected");
                },
                .safehouse => {
                    self.boss_hp = 100;
                    if (self.heat > 10) self.heat -|= 10;
                    m.cooldown = 15;
                    self.setToast("Rested at safehouse");
                },
                .vendor => {
                    if (self.treasury >= 50) {
                        self.treasury -= 50;
                        self.boss_hp = @min(100, self.boss_hp + 40);
                        m.cooldown = 10;
                        self.setToast("Bought supplies");
                    } else self.setToast("Not enough cash");
                },
            }
        }
    }

    pub fn activeVehicle(self: *const Session) *const phys.Vehicle {
        return &self.vehicles[self.active_vehicle];
    }
};
