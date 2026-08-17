const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const web = b.option(bool, "web", "Build WebAssembly + WebGL backend for Crucible") orelse false;

    const options = b.addOptions();
    options.addOption(bool, "enable_gpu", false);
    options.addOption(bool, "enable_android", false);
    options.addOption(bool, "enable_gles", false);
    options.addOption(bool, "enable_touch", false);
    options.addOption(bool, "enable_web", web);

    if (web) {
        // WASM target for the browser host
        const wasm_target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
        });

        const lib = b.addLibrary(.{
            .name = "crucible",
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main_web.zig"),
                .target = wasm_target,
                .optimize = optimize,
            }),
            .linkage = .dynamic, // produces .wasm
        });
        lib.root_module.addOptions("build_options", options);

        // Point at the Empire & Kin submodule so the same game sources are used.
        // Adjust path if your submodule lives elsewhere.
        lib.root_module.addIncludePath(b.path("vendor/empire-and-kin/src"));

        // TODO: once the full game is wired, add the game modules as imports
        // and implement the WebGL backend that satisfies the Backend VTable.

        b.installArtifact(lib);

        // Convenience step
        const install_wasm = b.addInstallArtifact(lib, .{
            .dest_dir = .{ .override = .{ .custom = "web/public" } },
        });
        b.step("wasm", "Build crucible.wasm into web/public").dependOn(&install_wasm.step);
    } else {
        // Non-web fallback: simple native stub for local experimentation
        const exe = b.addExecutable(.{
            .name = "crucible-native",
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main_web.zig"),
                .target = target,
                .optimize = optimize,
            }),
        });
        exe.root_module.addOptions("build_options", options);
        b.installArtifact(exe);
    }
}
