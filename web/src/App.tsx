import { useCallback, useEffect, useRef, useState } from "react";
import { loadCrucible, keyEventToCode, type CrucibleModule } from "./wasm";
import { GlRenderer } from "./gl/renderer";

type Status = "idle" | "loading" | "ready" | "error";

const VTYPES = ["Sedan", "Truck", "Motorcycle", "Taxi"];
const DISTRICTS = ["Little Italy", "Hell's Kitchen", "Brooklyn"];

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moduleRef = useRef<CrucibleModule | null>(null);
  const glRef = useRef<GlRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const metricTickRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [version, setVersion] = useState<number | null>(null);

  const [metrics, setMetrics] = useState({
    inVehicle: false,
    speed: 0,
    yaw: 0,
    x: 0,
    z: 0,
    drawCalls: 0,
    frame: 0,
    health: 100,
    heat: 0,
    treasury: 2500,
    day: 1,
    clock: 9,
    respect: 10,
    vtype: 0,
    district: 0,
  });

  const startLoop = useCallback((mod: CrucibleModule) => {
    const loop = (t: number) => {
      const dt = lastTimeRef.current ? (t - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = t;

      try {
        mod.crucible_frame(dt);
        glRef.current?.render(mod);
      } catch (err) {
        console.error("[crucible] frame error", err);
      }

      setFps((prev) => prev * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1);

      metricTickRef.current += 1;
      if (metricTickRef.current % 6 === 0) {
        setMetrics({
          inVehicle: mod.crucible_metric_in_vehicle() !== 0,
          speed: mod.crucible_metric_speed(),
          yaw: mod.crucible_metric_yaw(),
          x: mod.crucible_metric_player_x(),
          z: mod.crucible_metric_player_z(),
          drawCalls: mod.crucible_metric_draw_calls(),
          frame: mod.crucible_metric_frame(),
          health: mod.crucible_metric_health?.() ?? 100,
          heat: mod.crucible_metric_heat?.() ?? 0,
          treasury: mod.crucible_metric_treasury?.() ?? 0,
          day: mod.crucible_metric_day?.() ?? 1,
          clock: mod.crucible_metric_clock?.() ?? 12,
          respect: mod.crucible_metric_respect?.() ?? 0,
          vtype: mod.crucible_metric_vtype?.() ?? 0,
          district: mod.crucible_metric_district?.() ?? 0,
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const init = useCallback(async () => {
    if (!canvasRef.current) return;
    setStatus("loading");
    setError(null);
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      moduleRef.current?.crucible_shutdown();
      glRef.current?.destroy();
      glRef.current = null;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));

      const renderer = new GlRenderer(canvas);
      renderer.resize(canvas.width, canvas.height);
      glRef.current = renderer;

      const mod = await loadCrucible();
      moduleRef.current = mod;
      mod.crucible_init(canvas.width, canvas.height);
      setVersion(mod.crucible_version());
      setStatus("ready");
      startLoop(mod);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [startLoop]);

  useEffect(() => {
    init();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      moduleRef.current?.crucible_shutdown();
      glRef.current?.destroy();
    };
  }, [init]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      const h = Math.max(1, Math.floor(rect.height * devicePixelRatio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        glRef.current?.resize(w, h);
        moduleRef.current?.crucible_resize(w, h);
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const mod = moduleRef.current;
      if (!mod || status !== "ready") return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyF", "KeyH", "Space"].includes(e.code)) e.preventDefault();
      mod.crucible_key(keyEventToCode(e), down ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [status]);

  const hh = Math.floor(metrics.clock) % 24;
  const mm = Math.floor((metrics.clock % 1) * 60);

  return (
    <div className="app">
      <header className="header">
        <h1>CRUCIBLE</h1>
        <span className="status">
          {DISTRICTS[metrics.district] ?? "City"} ·{" "}
          {status === "ready"
            ? `ready (ABI v${version}) · WebGL2`
            : status === "loading"
              ? "loading…"
              : status === "error"
                ? "error"
                : "idle"}
        </span>
      </header>

      <div className="viewport">
        <canvas ref={canvasRef} tabIndex={0} />
        {status !== "ready" && (
          <div className="overlay">
            {status === "loading" && <p>Loading…</p>}
            {status === "error" && (
              <p style={{ color: "var(--danger)" }}>{error}</p>
            )}
          </div>
        )}
      </div>

      <aside className="panel">
        <section>
          <h2>Empire</h2>
          <div className="metrics">
            <div>
              Cash <strong>${metrics.treasury}</strong>
            </div>
            <div>
              Respect <strong>{metrics.respect}</strong>
            </div>
            <div>
              Heat <strong>{metrics.heat}</strong>
            </div>
            <div>
              HP <strong>{metrics.health}</strong>
            </div>
            <div>
              Day <strong>{metrics.day}</strong>
            </div>
            <div>
              Time{" "}
              <strong>
                {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}
              </strong>
            </div>
          </div>
        </section>

        <section>
          <h2>Session</h2>
          <div className="metrics">
            <div>
              FPS <strong>{fps.toFixed(0)}</strong>
            </div>
            <div>
              In vehicle <strong>{metrics.inVehicle ? "yes" : "no"}</strong>
            </div>
            <div>
              Speed <strong>{metrics.speed.toFixed(1)}</strong>
            </div>
            <div>
              Car <strong>{VTYPES[metrics.vtype] ?? "?"}</strong>
            </div>
            <div>
              Pos{" "}
              <strong>
                {metrics.x.toFixed(0)}, {metrics.z.toFixed(0)}
              </strong>
            </div>
          </div>
          <button onClick={init} disabled={status === "loading"} style={{ marginTop: "0.5rem" }}>
            Reload
          </button>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const m = moduleRef.current;
                if (!m) return;
                const data = {
                  district: m.crucible_metric_district?.() ?? 0,
                  on_foot: m.crucible_metric_in_vehicle() === 0 ? 1 : 0,
                  hp: m.crucible_metric_health?.() ?? 100,
                  heat: m.crucible_metric_heat?.() ?? 0,
                  treasury: m.crucible_metric_treasury?.() ?? 0,
                  respect: m.crucible_metric_respect?.() ?? 0,
                  day: m.crucible_metric_day?.() ?? 1,
                  clock: m.crucible_metric_clock?.() ?? 9,
                  x: m.crucible_metric_player_x(),
                  z: m.crucible_metric_player_z(),
                  yaw: m.crucible_metric_yaw(),
                };
                localStorage.setItem("crucible_save_v1", JSON.stringify(data));
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                const m = moduleRef.current;
                if (!m) return;
                const raw = localStorage.getItem("crucible_save_v1");
                if (!raw) return;
                try {
                  const d = JSON.parse(raw);
                  m.crucible_load_state?.(
                    d.district ?? 0,
                    d.on_foot ?? 1,
                    d.hp ?? 100,
                    d.heat ?? 0,
                    d.treasury ?? 2500,
                    d.respect ?? 10,
                    d.day ?? 1,
                    d.clock ?? 9,
                    d.x ?? 10,
                    d.z ?? 20,
                    d.yaw ?? 0
                  );
                } catch {}
              }}
            >
              Load
            </button>
          </div>
        </section>

        <section>
          <h2>Controls</h2>
          <div className="metrics" style={{ fontSize: "0.8rem" }}>
            WASD · walk / drive
            <br />
            E · enter / exit / interact
            <br />
            F · cycle vehicle type
            <br />
            H · heal (on foot)
            <br />
            Shift · handbrake
            <br />
            <br />
            Gold poles · missions
            <br />
            Green · rackets · Blue · safehouse
            <br />
            Purple · vendor
            <br />
            Orange gates · travel districts
            <br />
            <span style={{ color: "var(--muted)" }}>Runs in browser (WASM or JS demo)</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
