import { useCallback, useEffect, useRef, useState } from "react";
import { loadCrucible, type CrucibleModule } from "./wasm";

type Status = "idle" | "loading" | "ready" | "error";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moduleRef = useRef<CrucibleModule | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [version, setVersion] = useState<number | null>(null);

  // Simple live metrics (will be fed from real game state later)
  const [metrics, setMetrics] = useState({
    inVehicle: false,
    speed: 0,
    yaw: 0,
  });

  const startLoop = useCallback((mod: CrucibleModule) => {
    const loop = (t: number) => {
      const dt = lastTimeRef.current ? (t - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = t;

      mod.crucible_frame(dt);

      // Rough FPS
      setFps((prev) => prev * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const init = useCallback(async () => {
    if (!canvasRef.current) return;
    setStatus("loading");
    setError(null);

    try {
      const mod = await loadCrucible();
      moduleRef.current = mod;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;

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
    // Auto-attempt load when the page is ready.
    // If crucible.wasm is missing the error state will show a clear message.
    init();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      moduleRef.current?.crucible_shutdown();
    };
  }, [init]);

  // Keyboard → WASM
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const mod = moduleRef.current;
      if (!mod || status !== "ready") return;
      // Simple key mapping; will be expanded to match Empire & Kin controls
      const code = e.code.charCodeAt(0); // placeholder
      mod.crucible_key(code, down ? 1 : 0);
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

  // Pointer → WASM
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const mod = moduleRef.current;
      if (!mod || status !== "ready") return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      mod.crucible_pointer(x, y, e.buttons);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerup", onMove);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerup", onMove);
    };
  }, [status]);

  return (
    <div className="app">
      <header className="header">
        <h1>CRUCIBLE</h1>
        <span className="status">
          Empire & Kin browser tester ·{" "}
          {status === "ready"
            ? `ready (ABI v${version})`
            : status === "loading"
              ? "loading WASM…"
              : status === "error"
                ? "error"
                : "idle"}
        </span>
      </header>

      <div className="viewport">
        <canvas ref={canvasRef} tabIndex={0} />
        {status !== "ready" && (
          <div className="overlay">
            {status === "loading" && <p>Loading crucible.wasm…</p>}
            {status === "error" && (
              <div>
                <p style={{ color: "var(--danger)" }}>Failed to load module</p>
                <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  {error}
                </p>
                <p style={{ fontSize: "0.8rem", marginTop: "1rem", color: "var(--muted)" }}>
                  Build the WASM first:<br />
                  <code>zig build -Dweb=true -Doptimize=ReleaseFast</code>
                </p>
              </div>
            )}
            {status === "idle" && <p>Waiting…</p>}
          </div>
        )}
      </div>

      <aside className="panel">
        <section>
          <h2>Session</h2>
          <button onClick={init} disabled={status === "loading"}>
            Reload module
          </button>
        </section>

        <section>
          <h2>Metrics</h2>
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
              Yaw <strong>{metrics.yaw.toFixed(2)}</strong>
            </div>
          </div>
        </section>

        <section>
          <h2>Physics (preview)</h2>
          <label>
            Lateral grip
            <input type="range" min="0" max="2" step="0.05" defaultValue="1" />
          </label>
          <label>
            Handbrake strength
            <input type="range" min="0" max="2" step="0.05" defaultValue="1" />
          </label>
          <label>
            Spring stiffness
            <input type="range" min="0" max="2" step="0.05" defaultValue="1" />
          </label>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Live tuning will wire to PhysTuning once the full game is linked.
          </p>
        </section>

        <section>
          <h2>Controls</h2>
          <div className="metrics">
            WASD · drive / move<br />
            Shift · handbrake<br />
            E · enter / exit<br />
            Q/E · orbit · [ ] zoom
          </div>
        </section>
      </aside>
    </div>
  );
}
