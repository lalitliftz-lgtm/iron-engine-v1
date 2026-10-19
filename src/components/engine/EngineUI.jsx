// ============================================================
// IRON ENGINE — interactive UI (3-step wizard + result view)
// `full` = paid unlimited view. `!full` = free Week-1 sample.
// ============================================================
import { useState } from "react";
import { CONFIG } from "../../config/siteConfig";
import {
  C, SCHEMES, STICKING, LIFT_NAMES,
  resolveMaxes, buildProgram, programToText, downloadXLSX, platesPerSide,
} from "../../lib/engine";

function PlateBar({ kg }) {
  const plates = platesPerSide(kg);
  if (!plates) return null;
  return (
    <div style={{ marginTop: 10, padding: "10px 12px", background: C.iron, border: `1px solid ${C.lineSolid}`, borderRadius: 8 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.dim, marginBottom: 8, letterSpacing: 0.5 }}>
        TOP SET LOAD · {kg} KG · BAR 20 KG
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: 54 }}>
        <div style={{ width: 26, height: 6, background: "#555C68", borderRadius: 2 }} />
        <div style={{ width: 8, height: 20, background: "#555C68", borderRadius: 2 }} />
        {plates.map((p, i) => (
          <div key={i} style={{
            width: p.w >= 10 ? 13 : p.w >= 2.5 ? 9 : 7,
            height: p.w >= 25 ? 54 : p.w >= 20 ? 50 : p.w >= 15 ? 44 : p.w >= 10 ? 38 : p.w >= 5 ? 30 : p.w >= 2.5 ? 24 : 18,
            background: p.c, borderRadius: 3, border: "1px solid rgba(0,0,0,.35)",
          }} title={`${p.w} kg`} />
        ))}
        <div style={{ flex: 1, height: 6, background: "#555C68", borderRadius: 2, minWidth: 30 }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.knurl, whiteSpace: "nowrap", paddingLeft: 8 }}>
          {plates.map((p) => p.w).join(" + ")} <span style={{ color: C.dim }}>/side</span>
        </span>
      </div>
    </div>
  );
}

/* ---------------- UI pieces ---------------- */
function Seg({ options, value, onChange, multi, locked }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", opacity: locked ? 0.45 : 1 }}>
      {options.map((o) => {
        const active = multi ? value[o.v] : value === o.v;
        return (
          <button key={o.v}
            disabled={locked}
            onClick={() => !locked && (multi ? onChange({ ...value, [o.v]: !value[o.v] }) : onChange(o.v))}
            style={{
              padding: "10px 14px", borderRadius: 8, cursor: locked ? "not-allowed" : "pointer",
              border: `1px solid ${active ? C.red : C.lineSolid}`,
              background: active ? C.redDim : C.steel2,
              color: active ? "#fff" : C.knurl,
              fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: 14,
            }}>
            {o.l}
            {o.s && <span style={{ display: "block", fontSize: 11, fontWeight: 400, opacity: 0.75 }}>{o.s}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Label({ children, hint, pro }) {
  return (
    <div style={{ margin: "22px 0 8px" }}>
      <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: C.chalk, display: "flex", alignItems: "center", gap: 8 }}>
        {children}
        {pro && <span style={{ fontSize: 10, background: C.brass, color: "#14161B", padding: "2px 8px", borderRadius: 20, fontWeight: 700, letterSpacing: 1 }}>🔒 PRO</span>}
      </div>
      {hint && <div style={{ fontSize: 12.5, color: C.dim, marginTop: 2, textTransform: "none", letterSpacing: 0 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${C.lineSolid}`,
  background: C.iron, color: C.chalk, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16,
};

const TECH_RULES = [
  ["Bench", "Every rep = competition rep. Touch → settle → press. No sinking, no bouncing."],
  ["Squat", "Every rep to depth (hip crease below knee). Brace first, then descend. Same walkout every set."],
  ["Deadlift", "Pull the slack out — never jerk the bar off the floor. Hips and shoulders rise together."],
];

const STEP_TITLES = [
  { n: "01", t: "Athlete Basics", d: "Experience, training days, and the focus of your block" },
  { n: "02", t: "Strength Numbers", d: "Your 1RMs and weak-point analysis" },
  { n: "03", t: "Recovery & Health", d: "Injuries, sleep, stress — the engine adjusts for all of it" },
];

const td = { border: "1px solid #bbb", padding: "3px 5px", verticalAlign: "top" };

function PrintView({ program, form, maxes }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Archivo Black', sans-serif" }}>
          IRON ENGINE — {program.weeks.length} WEEK PROGRAM
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {form.name ? `Athlete: ${form.name} · ` : ""}
          Block: {form.exp === "beg" ? "Beginner Linear" : SCHEMES[form.goal].label} · {program.freq}
          {maxes?.squat ? ` · 1RM: SQ ${maxes.squat} / BP ${maxes.bench} / DL ${maxes.deadlift} kg${maxes.estimated ? " (est.)" : ""}` : ""}
        </div>
        <div style={{ fontSize: 12, marginTop: 2 }}>@{CONFIG.insta} · {CONFIG.site} · Rest days: {program.restDays.join(", ")}</div>
      </div>

      {program.weeks.map((w, wi) => (
        <div key={wi} style={{ pageBreakInside: "avoid", marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, background: "#000", color: "#fff", padding: "4px 10px", marginBottom: 6 }}>
            {w.label}{w.deload ? " — DELOAD" : ""}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <thead>
              <tr>
                {["Day", "Focus", "Exercise", "Sets", "Reps", "Load", "%1RM", "RPE", "Notes"].map((h) => (
                  <th key={h} style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "left", background: "#eee" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {w.days.map((d, di) =>
                [
                  ...d.main.map((m, mi) => (
                    <tr key={`m${di}-${mi}`}>
                      <td style={td}>{mi === 0 ? d.weekday : ""}</td>
                      <td style={td}>{mi === 0 ? d.title : ""}</td>
                      <td style={td}>{m.name}</td>
                      <td style={td}>{m.sets}</td>
                      <td style={td}>{m.reps}</td>
                      <td style={td}>{m.kg ? m.kg + " kg" : "—"}</td>
                      <td style={td}>{m.pct ? m.pct + "%" : "—"}</td>
                      <td style={td}>{m.rpe}</td>
                      <td style={td}>{m.note || ""}</td>
                    </tr>
                  )),
                  ...d.acc.map((a, ai) => (
                    <tr key={`a${di}-${ai}`}>
                      <td style={td}></td>
                      <td style={td}>{ai === 0 ? "Accessories" : ""}</td>
                      <td style={td}>{a.name}</td>
                      <td style={td} colSpan={2}>{a.sr}</td>
                      <td style={td}>—</td>
                      <td style={td}>—</td>
                      <td style={td}>{a.rpe === "—" ? "" : a.rpe}</td>
                      <td style={td}></td>
                    </tr>
                  )),
                ]
              )}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ border: "2px solid #000", padding: "8px 12px", marginTop: 10, pageBreakInside: "avoid" }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>TECHNIQUE STANDARDS — NON-NEGOTIABLE</div>
        {TECH_RULES.map(([h, b], i) => (
          <div key={i} style={{ fontSize: 11, marginBottom: 3 }}><b>{h}:</b> {b}</div>
        ))}
        <div style={{ fontSize: 11, marginTop: 6 }}>
          <b>Warm-up:</b> Bar ×8 → 40% ×5 → 55% ×3 → 70% ×2 → 80% ×1 · <b>RPE:</b> 7 = 3 left, 8 = 2 left, 9 = 1 left · <b>Rest:</b> mains 3–5 min, accessories 1.5–2 min
        </div>
        {program.testDay && (
          <div style={{ fontSize: 11, marginTop: 4 }}>
            <b>Test Day (Week 5):</b> 70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good. Max 3 heavy singles.
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, marginTop: 12 }}>
        1:1 coaching · technique review · meet-day strategy → DM <b>@{CONFIG.insta}</b>
      </div>
    </div>
  );
}

/* ==================== IRON ENGINE (full = paid, !full = free sample) ==================== */
export function IronEngine({ full, onUpgrade }) {
  const [form, setForm] = useState({
    name: "", exp: "int", days: 4, goal: "str", focus: "bal",
    rmMode: "know",
    maxes: { squat: "", bench: "", deadlift: "" },
    calc: { squat: { w: "", r: "" }, bench: { w: "", r: "" }, deadlift: { w: "", r: "" } },
    weak: "none", sticking: null,
    injuries: { back: false, knee: false, shoulder: false },
    sleep: "high", stress: "low",
  });
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [maxes, setMaxes] = useState(null);
  const [wk, setWk] = useState(0);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [printMode, setPrintMode] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setWeak = (v) => setForm((f) => ({ ...f, weak: v, sticking: v === "none" ? null : Object.keys(STICKING[v])[0] }));

  const generate = () => {
    const m = resolveMaxes(form);
    if (form.rmMode === "know" && (!m.squat || !m.bench || !m.deadlift)) {
      setErr("Enter all three 1RMs in Step 2 (in kg) — or pick a different mode");
      setStep(1);
      return;
    }
    if (form.rmMode === "calc") {
      for (const l of ["squat", "bench", "deadlift"]) {
        const r = Number(form.calc[l].r);
        if (!m[l]) { setErr("Enter a recent set for each lift in Step 2 (kg + reps)"); setStep(1); return; }
        if (r > 10) { setErr("Sets above 10 reps make the e1RM unreliable. Use a 1–10 rep set."); setStep(1); return; }
      }
    }
    setErr("");
    setMaxes(m);
    setResult(buildProgram(form, m));
    setWk(0);
    setTimeout(() => document.getElementById("result-top")?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(programToText(result, form));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };

  if (printMode && result && full) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", color: "#000", fontFamily: "'Barlow', sans-serif", padding: "16px" }}>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 16, maxWidth: 900, marginLeft: "auto", marginRight: "auto", flexWrap: "wrap" }}>
          <button onClick={() => setPrintMode(false)}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #999", background: "#f2f2f2", cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
            ← Back
          </button>
          <button onClick={() => window.print()}
            style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#C8102E", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
            🖨 Print / Save as PDF
          </button>
          <span style={{ fontSize: 12, color: "#666", alignSelf: "center" }}>Choose "Save as PDF" in the print dialog</span>
        </div>
        <PrintView program={result} form={form} maxes={maxes} />
      </div>
    );
  }

  const lockBtn = (label) => (
    <button onClick={onUpgrade}
      style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.lineSolid}`, background: C.steel2, color: C.dim, cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}>
      🔒 {label}
    </button>
  );

  const stepBar = (
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
      {STEP_TITLES.map((s, i) => (
        <button key={i} onClick={() => setStep(i)}
          style={{
            flex: 1, padding: "10px 6px", borderRadius: 8, cursor: "pointer", textAlign: "left",
            border: `1px solid ${step === i ? C.red : C.lineSolid}`,
            background: step === i ? C.redDim : C.steel,
            color: step === i ? "#fff" : C.knurl,
          }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1 }}>{s.n}</div>
          <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: 13 }}>{s.t}</div>
        </button>
      ))}
    </div>
  );

  const visibleWeeks = full ? [0, 1, 2, 3] : [0];

  return (
    <div>
      <section style={{ background: C.steel, border: `1px solid ${C.lineSolid}`, borderRadius: 14, padding: "22px 20px 26px" }}>
        {stepBar}
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 4 }}>{STEP_TITLES[step].d}</div>

        {step === 0 && (
          <>
            <Label hint="Shown on your program and export files">Athlete Name (optional)</Label>
            <input style={inputStyle} placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} />

            <Label hint="How long you've been training with structure">Training Experience</Label>
            <Seg value={form.exp} onChange={(v) => set("exp", v)} options={[
              { v: "beg", l: "Beginner", s: "< 1 year" },
              { v: "int", l: "Intermediate", s: "1–3 years" },
              { v: "adv", l: "Advanced", s: "3+ years" },
            ]} />

            <Label hint="Be realistic — pick what you can actually sustain">Days Per Week</Label>
            <Seg value={form.days} onChange={(v) => set("days", v)} options={[
              { v: 3, l: "3" }, { v: 4, l: "4" }, { v: 5, l: "5" }, { v: 6, l: "6" },
            ]} />
            {form.exp === "beg" && form.days > 3 && (
              <div style={{ marginTop: 8, fontSize: 13, color: C.knurl, background: C.steel2, padding: "8px 12px", borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
                3 heavy days is optimal for beginners — extra days become technique + GPP work.
              </div>
            )}

            {form.exp !== "beg" && (
              <>
                <Label hint="The overall goal of this block">Block Goal</Label>
                <Seg value={form.goal} onChange={(v) => set("goal", v)} options={[
                  { v: "hyp", l: "Base Block", s: "muscle + capacity" },
                  { v: "str", l: "Strength Block", s: "heavy 2–4s at 80–90%" },
                  { v: "peak", l: "Peaking", s: "meet / 1RM prep" },
                ]} />

                <Label pro={!full} hint="Decides which lift gets higher training frequency">Block Focus</Label>
                <Seg locked={!full} value={form.focus} onChange={(v) => set("focus", v)} options={[
                  { v: "bal", l: "Balanced", s: "all three equal" },
                  { v: "squat", l: "Squat Focus" },
                  { v: "bench", l: "Bench Focus" },
                  { v: "dead", l: "Deadlift Focus" },
                ]} />
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Label hint="Used to calculate your working weights">How Should We Get Your 1RM?</Label>
            <Seg value={form.rmMode} onChange={(v) => set("rmMode", v)} options={[
              { v: "know", l: "I know my 1RM" },
              { v: "calc", l: "Calculate from a recent set", s: "e.g. 100 kg × 5" },
              { v: "none", l: "I don't know my max" },
            ]} />
            {form.rmMode === "know" && (
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                {["squat", "bench", "deadlift"].map((l) => (
                  <div key={l} style={{ flex: "1 1 100px" }}>
                    <div style={{ fontSize: 12, color: C.dim, marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>{l}</div>
                    <input type="number" inputMode="decimal" placeholder="kg" style={inputStyle}
                      value={form.maxes[l]}
                      onChange={(e) => setForm((f) => ({ ...f, maxes: { ...f.maxes, [l]: e.target.value } }))} />
                  </div>
                ))}
              </div>
            )}
            {form.rmMode === "calc" && (
              <div style={{ marginTop: 12 }}>
                {["squat", "bench", "deadlift"].map((l) => (
                  <div key={l} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-end" }}>
                    <div style={{ width: 80, fontSize: 12, color: C.dim, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", paddingBottom: 14 }}>{l}</div>
                    <div style={{ flex: 1 }}>
                      <input type="number" inputMode="decimal" placeholder="kg" style={inputStyle}
                        value={form.calc[l].w}
                        onChange={(e) => setForm((f) => ({ ...f, calc: { ...f.calc, [l]: { ...f.calc[l], w: e.target.value } } }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="number" inputMode="numeric" placeholder="reps (1–10)" style={inputStyle}
                        value={form.calc[l].r}
                        onChange={(e) => setForm((f) => ({ ...f, calc: { ...f.calc, [l]: { ...f.calc[l], r: e.target.value } } }))} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 12.5, color: C.dim }}>Estimated via the Epley formula — use a recent clean set, not a grinder.</div>
              </div>
            )}

            <Label pro={!full} hint="Your weakest lift gets targeted extra volume">Weakest Lift</Label>
            <Seg locked={!full} value={form.weak} onChange={setWeak} options={[
              { v: "none", l: "Balanced" }, { v: "squat", l: "Squat" }, { v: "bench", l: "Bench" }, { v: "deadlift", l: "Deadlift" },
            ]} />

            {full && form.weak !== "none" && (
              <>
                <Label hint="Where the lift fails — the engine assigns the right variation">{LIFT_NAMES[form.weak]} — Sticking Point</Label>
                <Seg value={form.sticking} onChange={(v) => set("sticking", v)}
                  options={Object.entries(STICKING[form.weak]).map(([k, v]) => ({ v: k, l: v.l }))} />
                <div style={{ marginTop: 8, fontSize: 13, color: C.knurl, background: C.steel2, padding: "8px 12px", borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
                  Assigned: <b style={{ color: C.chalk }}>{STICKING[form.weak][form.sticking]?.variation.name}</b> +{" "}
                  <b style={{ color: C.chalk }}>{STICKING[form.weak][form.sticking]?.acc.name}</b>
                </div>
              </>
            )}
            {!full && (
              <div style={{ marginTop: 10, fontSize: 13, color: C.knurl, background: C.steel2, padding: "10px 12px", borderRadius: 8, borderLeft: `3px solid ${C.brass}` }}>
                🔒 <b style={{ color: C.chalk }}>Sticking-point analysis is a PRO feature</b> — tell the engine exactly where your lift fails (off the floor, at lockout, in the hole) and it programs the specific fix.
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {/* Safety is never a paid extra. */}
            <Label hint="The engine swaps exercises and adds safety caps">Injury / Issue (multi-select)</Label>
            <Seg multi value={form.injuries} onChange={(v) => set("injuries", v)} options={[
              { v: "back", l: "Lower Back" }, { v: "knee", l: "Knee" }, { v: "shoulder", l: "Shoulder" },
            ]} />
            {(form.injuries.back || form.injuries.knee || form.injuries.shoulder) && (
              <div style={{ marginTop: 8, fontSize: 13, color: C.knurl, background: C.steel2, padding: "8px 12px", borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
                Don't train through active pain — get assessed. Pain = the set ends. Always.
              </div>
            )}

            <Label hint="Volume auto-adjusts to your recovery">Sleep Average</Label>
            <Seg value={form.sleep} onChange={(v) => set("sleep", v)} options={[
              { v: "high", l: "7+ hrs" }, { v: "mid", l: "6–7 hrs" }, { v: "low", l: "< 6 hrs" },
            ]} />

            <Label>Stress Level</Label>
            <Seg value={form.stress} onChange={(v) => set("stress", v)} options={[
              { v: "low", l: "Low" }, { v: "mid", l: "Moderate" }, { v: "high", l: "High" },
            ]} />
          </>
        )}

        {err && <div style={{ marginTop: 16, color: "#FF6B6B", fontSize: 14, fontWeight: 600 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              style={{ padding: "14px 20px", borderRadius: 10, border: `1px solid ${C.lineSolid}`, background: C.steel2, color: C.chalk, cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow', sans-serif", fontSize: 15 }}>
              ← Back
            </button>
          )}
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)}
              style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", cursor: "pointer", background: C.red, color: "#fff", fontFamily: "'Archivo Black', sans-serif", fontSize: 16, letterSpacing: 1 }}>
              NEXT →
            </button>
          ) : (
            <button onClick={generate}
              style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", cursor: "pointer", background: C.red, color: "#fff", fontFamily: "'Archivo Black', sans-serif", fontSize: 16, letterSpacing: 1 }}>
              {full ? "GENERATE PROGRAM →" : "GENERATE FREE SAMPLE →"}
            </button>
          )}
        </div>
      </section>

      {result && (
        <section id="result-top" style={{ marginTop: 34 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.red, letterSpacing: 2 }}>
                {form.name ? form.name.toUpperCase() + " · " : ""}{full ? "YOUR BLOCK" : "FREE SAMPLE · WEEK 1 ONLY"}
              </div>
              <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 26, marginTop: 4 }}>
                {form.exp === "beg" ? "Beginner Linear Block" : SCHEMES[form.goal].label}
              </h2>
              <div style={{ color: C.knurl, fontSize: 13, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
                {result.freq}
                {maxes?.estimated ? ` · e1RM: SQ ${maxes.squat} / BP ${maxes.bench} / DL ${maxes.deadlift}` : ""}
              </div>
              <div style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>
                Rest days: {result.restDays.join(", ")} — recovery/mobility
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {full ? (
                <>
                  <button onClick={copy} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.lineSolid}`, background: C.steel2, color: copied ? "#5EDB8A" : C.chalk, cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}>
                    {copied ? "✓ Copied" : "Copy Text"}
                  </button>
                  <button onClick={() => downloadXLSX(result, form)} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.red}`, background: C.redDim, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}>
                    ⬇ Excel / Sheets
                  </button>
                  <button onClick={() => setPrintMode(true)} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.lineSolid}`, background: C.steel2, color: C.chalk, cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}>
                    📄 PDF View
                  </button>
                </>
              ) : (
                <>
                  {lockBtn("Excel Export")}
                  {lockBtn("PDF Export")}
                </>
              )}
            </div>
          </div>

          {result.rec.note && (
            <div style={{ marginTop: 14, fontSize: 13.5, background: C.steel2, padding: "10px 14px", borderRadius: 8, borderLeft: `3px solid ${result.rec.level === "poor" ? C.red : C.knurl}` }}>
              <b>Autoregulation:</b> {result.rec.note}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, margin: "20px 0 16px" }}>
            {result.weeks.map((w, i) => {
              const allowed = visibleWeeks.includes(i);
              return (
                <button key={i} onClick={() => (allowed ? setWk(i) : onUpgrade())}
                  style={{
                    flex: 1, padding: "12px 4px", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${wk === i && allowed ? C.red : C.lineSolid}`,
                    background: wk === i && allowed ? C.redDim : C.steel,
                    color: allowed ? (wk === i ? "#fff" : C.knurl) : C.dim,
                    fontFamily: "'Barlow Semi Condensed', sans-serif", fontWeight: 600, fontSize: 14,
                  }}>
                  {allowed ? w.label : `🔒 ${w.label}`}
                  {w.deload && allowed && <span style={{ display: "block", fontSize: 10, letterSpacing: 1, opacity: 0.8 }}>DELOAD</span>}
                </button>
              );
            })}
          </div>

          {!full && (
            <div style={{ marginBottom: 16, background: `linear-gradient(135deg, ${C.redDim} 0%, ${C.steel} 70%)`, border: `1px solid ${C.red}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, color: C.chalk }}>
                <b>This is Week 1 of 4.</b> Unlock the full block — progression, deload, sticking-point work, workout logger and Excel + PDF export.
                <div style={{ fontSize: 12.5, color: C.knurl, marginTop: 4 }}>Ye sirf Week 1 hai. Poora block (Week 2–4) Pro mein unlock hota hai.</div>
              </div>
              <button onClick={onUpgrade}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: C.red, color: "#fff", cursor: "pointer", fontFamily: "'Archivo Black', sans-serif", fontSize: 14, letterSpacing: 1, whiteSpace: "nowrap" }}>
                UNLOCK FULL ACCESS
              </button>
            </div>
          )}

          {result.weeks[wk].deload && full && (
            <div style={{ marginBottom: 14, fontSize: 13.5, background: C.steel2, padding: "10px 14px", borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
              <b>Deload week.</b> The weight will feel light — that's the point.{result.testDay ? " Test Day comes in Week 5 (protocol in the rules below)." : ""}
            </div>
          )}

          {result.weeks[full ? wk : 0].days.map((d, di) => (
            <div key={di} style={{ background: C.steel, border: `1px solid ${C.lineSolid}`, borderRadius: 12, padding: "16px 16px 18px", marginBottom: 14, opacity: d.optional ? 0.85 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 4 }}>
                <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 16, color: d.optional ? C.knurl : C.chalk }}>{d.title}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.red, letterSpacing: 1, textTransform: "uppercase" }}>{d.weekday}</span>
              </div>

              {d.main.map((m, mi) => (
                <div key={mi} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15.5 }}>{m.name}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14.5 }}>
                      {m.sets} × {m.reps}
                      {m.pct && <span style={{ color: C.red, fontWeight: 600 }}> @ {m.pct}%</span>}
                      {m.kg ? <span style={{ color: C.brass }}> · {m.kg} kg</span> : null}
                      <span style={{ color: C.knurl }}> · {m.rpe}</span>
                    </span>
                  </div>
                  {m.note && <div style={{ fontSize: 12.5, color: C.knurl, marginTop: 3 }}>→ {m.note}</div>}
                  {mi === 0 && m.kg && m.kg > 20 && <PlateBar kg={m.kg} />}
                </div>
              ))}

              {d.acc.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${C.lineSolid}` }}>
                  <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontSize: 12, letterSpacing: 1.5, color: C.dim, textTransform: "uppercase", marginBottom: 8 }}>Accessories</div>
                  {d.acc.map((a, ai) => (
                    <div key={ai} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, padding: "4px 0", color: C.knurl, flexWrap: "wrap" }}>
                      <span>{a.name.startsWith("Weak-point") ? <b style={{ color: C.brass }}>{a.name}</b> : a.name}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, whiteSpace: "nowrap" }}>{a.sr} {a.rpe !== "—" ? `· ${a.rpe}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div style={{ background: "#26090E", border: `1px solid ${C.red}`, borderRadius: 12, padding: "16px 18px", marginTop: 20 }}>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 15, color: "#FF8A96", marginBottom: 10 }}>
              TECHNIQUE STANDARDS — NON-NEGOTIABLE
            </div>
            {TECH_RULES.map(([h, b], i) => (
              <div key={i} style={{ marginBottom: 8, fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: C.chalk }}>{h}: </span>
                <span style={{ color: C.knurl }}>{b}</span>
              </div>
            ))}
          </div>

          <div style={{ background: C.steel, border: `1px solid ${C.lineSolid}`, borderRadius: 12, padding: "18px", marginTop: 14 }}>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 16, marginBottom: 12 }}>EXECUTION RULES</div>
            {[
              ["Warm-up", "Bar × 8 → 40% × 5 → 55% × 3 → 70% × 2 → 80% × 1 → work sets."],
              ["RPE", "RPE 7 = 3 reps in the tank. RPE 8 = 2. RPE 9 = 1. On a bad day, drop the % and follow RPE — RPE is the final judge."],
              ["Auto-regulation", "If RPE runs higher than prescribed → reduce the weight by 5%. Ego lifting ruins programs."],
              ["Rest", "Main lifts: 3–5 min. Accessories: 1.5–2 min."],
              ...(result.testDay ? [
                ["Test Day (Week 5)", "After the deload: 70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good. Max 3 heavy singles."],
                ["PR Reality", "Beginners: a PR is almost certain. Intermediates: 2.5–5 kg is realistic. Big PRs come from block sequencing — Base → Strength → Peak."],
              ] : []),
            ].map(([h, b], i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <span style={{ fontWeight: 700 }}>{h}: </span>
                <span style={{ color: C.knurl, fontSize: 14.5 }}>{b}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, textAlign: "center", color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
            Video technique review, deep weak-point diagnosis, meet-day strategy —<br />
            that's what 1:1 coaching is for. <span style={{ color: C.red, fontWeight: 700 }}>DM @{CONFIG.insta}</span>
          </div>
        </section>
      )}
    </div>
  );
}
