//! WebGL backend — implements the same Backend VTable contract as
//! Empire & Kin's gl_backend / gles_backend / null_backend.
//!
//! One simulation, three hosts (desktop, Android, browser).
//!
//! Drawing is currently a structured stub that records commands and exposes
//! state the JS host can inspect. Next steps:
//!   A) JS-side WebGL consuming a command buffer from WASM, or
//!   B) pure-WASM WebGL bindings via importObject.
//!
//! Input is fed from the React host via crucible_key / crucible_pointer.

const std = @import("std");

// ---------------------------------------------------------------------------
// Types mirroring empire-and-kin/src/engine/backend.zig
// (kept local so Crucible builds before the submodule is fully linked)
// ---------------------------------------------------------------------------

pub const InputState = struct {
    move_x: f32 = 0,
    move_y: f32 = 0,
    interact: bool = false,
    attack: bool = false,
    pause: bool = false,
    handbrake: bool = false,
};

pub const Color = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8 = 255,

    pub fn rgb(r: u8, g: u8, b: u8) Color {
        return .{ .r = r, .g = g, .b = b };
    }
};

pub const Vec3 = struct {
    x: f32 = 0,
    y: f32 = 0,
    z: f32 = 0,
};

pub const Camera = struct {
    position: Vec3 = .{ .x = 0, .y = 12, .z = -16 },
    target: Vec3 = .{ .x = 0, .y = 0, .z = 0 },
    up: Vec3 = .{ .x = 0, .y = 1, .z = 0 },
    fov_deg: f32 = 55,
};

pub const VTable = struct {
    init: *const fn (title: []const u8, width: u32, height: u32) anyerror!void,
    shutdown: *const fn () void,
    beginFrame: *const fn () void,
    endFrame: *const fn () void,
    pollInput: *const fn () InputState,
    deltaTime: *const fn () f64,
    shouldClose: *const fn () bool,
    drawText: *const fn (text: []const u8, x: i32, y: i32, color: Color) void,
    clear: *const fn (color: Color) void,
    setCamera: *const fn (cam: Camera) void,
    drawGround: *const fn (size: f32, color: Color) void,
    drawBox: *const fn (pos: Vec3, w: f32, h: f32, d: f32, color: Color) void,
    drawPlayerProxy: *const fn (pos: Vec3, facing_yaw: f32, color: Color) void,
    drawBuilding: *const fn (pos: Vec3, w: f32, h: f32, d: f32, color: Color) bool,
    drawProp: *const fn (pos: Vec3, w: f32, h: f32, d: f32, color: Color) bool,
    drawCharacter: *const fn (pos: Vec3, facing_yaw: f32, scale: f32, color: Color) bool,
    drawVehicle: *const fn (pos: Vec3, yaw: f32, pitch: f32, roll: f32, wheel_spin: f32, steer: f32, health: u8, color: Color) bool,
};

pub const Backend = struct {
    vtable: VTable,

    pub fn init(self: Backend, title: []const u8, w: u32, h: u32) !void {
        try self.vtable.init(title, w, h);
    }
    pub fn shutdown(self: Backend) void {
        self.vtable.shutdown();
    }
    pub fn beginFrame(self: Backend) void {
        self.vtable.beginFrame();
    }
    pub fn endFrame(self: Backend) void {
        self.vtable.endFrame();
    }
    pub fn pollInput(self: Backend) InputState {
        return self.vtable.pollInput();
    }
    pub fn deltaTime(self: Backend) f64 {
        return self.vtable.deltaTime();
    }
    pub fn shouldClose(self: Backend) bool {
        return self.vtable.shouldClose();
    }
    pub fn drawText(self: Backend, text: []const u8, x: i32, y: i32, color: Color) void {
        self.vtable.drawText(text, x, y, color);
    }
    pub fn clear(self: Backend, color: Color) void {
        self.vtable.clear(color);
    }
    pub fn setCamera(self: Backend, camera: Camera) void {
        self.vtable.setCamera(camera);
    }
    pub fn drawGround(self: Backend, size: f32, color: Color) void {
        self.vtable.drawGround(size, color);
    }
    pub fn drawBox(self: Backend, pos: Vec3, w: f32, h: f32, d: f32, color: Color) void {
        self.vtable.drawBox(pos, w, h, d, color);
    }
    pub fn drawPlayerProxy(self: Backend, pos: Vec3, facing_yaw: f32, color: Color) void {
        self.vtable.drawPlayerProxy(pos, facing_yaw, color);
    }
    pub fn drawBuilding(self: Backend, pos: Vec3, w: f32, h: f32, d: f32, color: Color) bool {
        return self.vtable.drawBuilding(pos, w, h, d, color);
    }
    pub fn drawProp(self: Backend, pos: Vec3, w: f32, h: f32, d: f32, color: Color) bool {
        return self.vtable.drawProp(pos, w, h, d, color);
    }
    pub fn drawCharacter(self: Backend, pos: Vec3, facing_yaw: f32, scale: f32, color: Color) bool {
        return self.vtable.drawCharacter(pos, facing_yaw, scale, color);
    }
    pub fn drawVehicle(self: Backend, pos: Vec3, yaw: f32, pitch: f32, roll: f32, wheel_spin: f32, steer: f32, health: u8, color: Color) bool {
        return self.vtable.drawVehicle(pos, yaw, pitch, roll, wheel_spin, steer, health, color);
    }
};

var width: u32 = 1280;
var height: u32 = 720;
var frame_count: u64 = 0;
var dt: f64 = 1.0 / 60.0;
var close_requested: bool = false;
var cam: Camera = .{};
var clear_color: Color = Color.rgb(20, 22, 28);

var key_w: bool = false;
var key_a: bool = false;
var key_s: bool = false;
var key_d: bool = false;
var key_e: bool = false;
var key_f: bool = false;
var key_h: bool = false;
var key_shift: bool = false;
var key_escape: bool = false;
var key_space: bool = false;
var pointer_x: f32 = 0;
var pointer_y: f32 = 0;
var pointer_buttons: i32 = 0;

pub var last_player_x: f32 = 0;
pub var last_player_z: f32 = 0;
pub var last_vehicle_yaw: f32 = 0;
pub var last_vehicle_pitch: f32 = 0;
pub var last_vehicle_roll: f32 = 0;
pub var draw_calls: u32 = 0;
pub var in_vehicle_hint: bool = false;

pub fn setKey(code: i32, down: bool) void {
    switch (code) {
        87, 119 => key_w = down,
        65, 97 => key_a = down,
        83, 115 => key_s = down,
        68, 100 => key_d = down,
        69, 101 => key_e = down,
        70, 102 => key_f = down,
        72, 104 => key_h = down,
        16 => key_shift = down,
        27 => key_escape = down,
        32 => key_space = down,
        else => {},
    }
}

pub fn setPointer(x: f32, y: f32, buttons: i32) void {
    pointer_x = x;
    pointer_y = y;
    pointer_buttons = buttons;
}

pub fn setSize(w: u32, h: u32) void {
    width = w;
    height = h;
}

pub fn requestClose() void {
    close_requested = true;
}

pub fn setDeltaTime(seconds: f64) void {
    dt = seconds;
}

pub fn getFrameCount() u64 {
    return frame_count;
}

pub fn getDrawCalls() u32 {
    return draw_calls;
}

pub fn keyH() bool {
    return key_h;
}

fn initImpl(title: []const u8, w: u32, h: u32) !void {
    _ = title;
    width = w;
    height = h;
    frame_count = 0;
    close_requested = false;
    cam = .{};
    draw_calls = 0;
}

fn shutdownImpl() void {
    close_requested = true;
}

fn beginFrameImpl() void {
    frame_count += 1;
    draw_calls = 0;
    if (dt <= 0 or dt > 0.25) dt = 1.0 / 60.0;
}

fn endFrameImpl() void {}

fn pollInputImpl() InputState {
    var st: InputState = .{};
    if (key_a) st.move_x -= 1;
    if (key_d) st.move_x += 1;
    if (key_w) st.move_y += 1;
    if (key_s) st.move_y -= 1;
    st.interact = key_e;
    st.attack = key_f;
    st.pause = key_escape;
    st.handbrake = key_shift;
    return st;
}

fn deltaTimeImpl() f64 {
    return dt;
}

fn shouldCloseImpl() bool {
    return close_requested;
}

fn drawTextImpl(text: []const u8, x: i32, y: i32, color: Color) void {
    _ = text;
    _ = x;
    _ = y;
    _ = color;
    draw_calls += 1;
}

fn clearImpl(color: Color) void {
    clear_color = color;
    draw_calls += 1;
}

fn setCameraImpl(c: Camera) void {
    cam = c;
}

fn drawGroundImpl(size: f32, color: Color) void {
    _ = size;
    _ = color;
    draw_calls += 1;
}

fn drawBoxImpl(pos: Vec3, w: f32, h: f32, d: f32, color: Color) void {
    _ = pos;
    _ = w;
    _ = h;
    _ = d;
    _ = color;
    draw_calls += 1;
}

fn drawPlayerProxyImpl(pos: Vec3, facing_yaw: f32, color: Color) void {
    _ = facing_yaw;
    _ = color;
    last_player_x = pos.x;
    last_player_z = pos.z;
    draw_calls += 1;
}

fn drawBuildingImpl(pos: Vec3, w: f32, h: f32, d: f32, color: Color) bool {
    _ = pos;
    _ = w;
    _ = h;
    _ = d;
    _ = color;
    draw_calls += 1;
    return false;
}

fn drawPropImpl(pos: Vec3, w: f32, h: f32, d: f32, color: Color) bool {
    _ = pos;
    _ = w;
    _ = h;
    _ = d;
    _ = color;
    draw_calls += 1;
    return false;
}

fn drawCharacterImpl(pos: Vec3, facing_yaw: f32, scale: f32, color: Color) bool {
    _ = pos;
    _ = facing_yaw;
    _ = scale;
    _ = color;
    draw_calls += 1;
    return false;
}

fn drawVehicleImpl(pos: Vec3, yaw: f32, pitch: f32, roll: f32, wheel_spin: f32, steer: f32, health: u8, color: Color) bool {
    _ = wheel_spin;
    _ = steer;
    _ = health;
    _ = color;
    last_player_x = pos.x;
    last_player_z = pos.z;
    last_vehicle_yaw = yaw;
    last_vehicle_pitch = pitch;
    last_vehicle_roll = roll;
    in_vehicle_hint = true;
    draw_calls += 1;
    return false;
}

pub fn getBackend() Backend {
    return .{
        .vtable = .{
            .init = initImpl,
            .shutdown = shutdownImpl,
            .beginFrame = beginFrameImpl,
            .endFrame = endFrameImpl,
            .pollInput = pollInputImpl,
            .deltaTime = deltaTimeImpl,
            .shouldClose = shouldCloseImpl,
            .drawText = drawTextImpl,
            .clear = clearImpl,
            .setCamera = setCameraImpl,
            .drawGround = drawGroundImpl,
            .drawBox = drawBoxImpl,
            .drawPlayerProxy = drawPlayerProxyImpl,
            .drawBuilding = drawBuildingImpl,
            .drawProp = drawPropImpl,
            .drawCharacter = drawCharacterImpl,
            .drawVehicle = drawVehicleImpl,
        },
    };
}
