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
        // wasm32-freestanding: executable + -fno-entry -rdynamic so export fns
        // appear in the .wasm. (addLibrary + .dynamic is unavailable on freestanding.)
        const wasm_target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
        });

        const exe = b.addExecutable(.{
            .name = "crucible",
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main_web.zig"),
                .target = wasm_target,
                .optimize = optimize,
            }),
        });
        exe.entry = .disabled;
        exe.rdynamic = true;
        exe.root_module.addOptions("build_options", options);
        // Optional include path for upstream sources when submodule is present.
        exe.root_module.addIncludePath(b.path("vendor/empire-and-kin/src"));

        b.installArtifact(exe);

        const install_wasm = b.addInstallArtifact(exe, .{
            .dest_dir = .{ .override = .{ .custom = "web/public" } },
        });
        b.step("wasm", "Build crucible.wasm into web/public").dependOn(&install_wasm.step);
    } else {
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
