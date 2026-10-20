// ============================================================
//  LANDING — public storefront (dark, LalitLifts branding)
//  The page sells Iron Engine: hero → real example output → free Week 1 →
//  coach → pricing → System 2.0 guide → 1:1 coaching.
//  CTAs route into the real Supabase sign-up + PayU checkout flow.
// ============================================================
import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CONFIG } from "../config/siteConfig";
import { C, buildProgram, localYmd } from "../lib/engine";
import EngineGate from "../components/engine/EngineGate";

// The example is real engine output for a fixed sample lifter — what a visitor would get, not a mock-up.
const SAMPLE = { exp: "int", days: 4, maxes: { squat: 140, bench: 100, deadlift: 180 } };
const SAMPLE_FORM = {
  goal: "hyp", focus: "bal", weak: "none", sticking: null, weakType: "strength", sleep: "high", stress: "low",
  exp: SAMPLE.exp, days: SAMPLE.days, injuries: {}, equipment: "commercial", style: "balanced", meetDays: null, squatBar: "low",
};
const rupees = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function Landing() {
  const navigate = useNavigate();
  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  // Route a product into the account/checkout flow.
  const buy = (productName) =>
    navigate(
      `/signup?next=${encodeURIComponent(
        "/dashboard/subscription"
      )}&product=${encodeURIComponent(productName)}`
    );

  const sample = useMemo(() => {
    try { return buildProgram({ ...SAMPLE_FORM, today: localYmd() }, SAMPLE.maxes); } catch { return null; }
  }, []);
  const guide = CONFIG.products.find((p) => p.id === "system2");
  const plans = CONFIG.proPlans;
  const monthly = plans[0].price;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.iron,
        color: C.chalk,
        fontFamily: "'Barlow', sans-serif",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Barlow:wght@400;600;700&family=Barlow+Semi+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;600&display=swap');
        .ll-card { transition: transform .18s ease, border-color .18s ease; }
        .ll-card:hover { transform: translateY(-3px); border-color: ${C.red} !important; }
        @media (prefers-reduced-motion: reduce) { .ll-card { transition: none !important; } }
        /* Phones: the sticky bar keeps only Log in / Get Started (the page sections are a scroll away). */
        @media (max-width: 520px) { .ll-nav-scroll { display: none !important; } }
      `}</style>

      {/* ---------- NAV ---------- */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(17,19,24,.94)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.lineSolid}`,
          padding: "14px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1020,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 18, letterSpacing: 0.5 }}>
            LALIT<span style={{ color: C.red }}>LIFTS</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              ["Example", "preview"],
              ["Pricing", "pricing"],
              ["Coach", "coach"],
            ].map(([l, id]) => (
              <button key={id} className="ll-nav-scroll" onClick={() => scrollTo(id)} style={navBtn}>
                {l}
              </button>
            ))}
            <Link to="/login" style={{ padding: "8px 14px", borderRadius: 8, color: C.chalk, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Log in
            </Link>
            <Link to="/signup" style={{ padding: "8px 16px", borderRadius: 8, background: C.red, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------- HERO: the product, in one look ---------- */}
      <header
        style={{
          position: "relative",
          padding: "64px 20px 60px",
          background: `linear-gradient(180deg, ${C.steel} 0%, ${C.iron} 100%)`,
          borderBottom: `1px solid ${C.lineSolid}`,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -30,
            top: 10,
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(120px, 24vw, 280px)",
            lineHeight: 1,
            color: "transparent",
            WebkitTextStroke: "1px rgba(200,16,46,.18)",
            userSelect: "none",
            pointerEvents: "none",
            transform: "rotate(-4deg)",
          }}
        >
          SBD
        </div>
        <div style={{ maxWidth: 1020, margin: "0 auto", position: "relative" }}>
          <div style={{ ...eyebrow, marginBottom: 14 }}>
            IRON<span style={{ color: C.chalk }}>ENGINE</span> · BY LALITLIFTS
          </div>
          <h1
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "clamp(32px, 7vw, 58px)",
              lineHeight: 1.04,
              letterSpacing: -1,
              maxWidth: 820,
            }}
          >
            5-minute assessment.<br />
            Your 4-week block — <span style={{ color: C.red }}>kg, RPE and deload</span> set. Starting today.
          </h1>
          <p style={{ fontSize: "clamp(16px, 2.6vw, 20px)", color: C.chalk, marginTop: 18, maxWidth: 640, lineHeight: 1.45 }}>
            My coaching system, in code. Not ChatGPT — the same rules I use on my clients.
          </p>
          <p style={{ color: C.knurl, marginTop: 8, fontSize: 14.5, maxWidth: 640 }}>
            5 minute ka assessment → tumhara 4 hafte ka block, kg/RPE/deload ke saath. Aaj se.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => scrollTo("try")} style={{ ...btnBig, background: C.red, color: "#fff" }}>
              TRY WEEK 1 FREE →
            </button>
            <span style={{ color: C.knurl, fontSize: 13.5 }}>No login · no card</span>
          </div>
          <button onClick={() => scrollTo("preview")} style={{ marginTop: 16, background: "none", border: "none", color: C.brass, cursor: "pointer", fontSize: 14, fontWeight: 700, padding: 0 }}>
            See a real example first ↓
          </button>
          <p style={{ color: C.brass, marginTop: 26, fontSize: 13.5, fontFamily: "'Barlow Semi Condensed', sans-serif", letterSpacing: 0.5 }}>
            Built by {CONFIG.coach.name} · {CONFIG.credentials}
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 1020, margin: "0 auto", padding: "0 20px 80px" }}>
        {/* ---------- EXAMPLE: real engine output before any form ---------- */}
        {sample && (
          <section id="preview" style={{ paddingTop: 56 }}>
            <div style={eyebrow}>WHAT YOU GET</div>
            <h2 style={h2}>This is what the engine builds</h2>
            <p style={{ color: C.knurl, fontSize: 14.5, marginBottom: 22, maxWidth: 680 }}>
              Real output for a sample lifter — intermediate, {SAMPLE.days} days a week, squat {SAMPLE.maxes.squat} · bench {SAMPLE.maxes.bench} · deadlift {SAMPLE.maxes.deadlift} kg. Yours is built from your numbers, schedule, injuries and recovery.
            </p>
            <SamplePhones program={sample} />
            <div style={{ textAlign: "center", marginTop: 26 }}>
              <button onClick={() => scrollTo("try")} style={{ ...btnBig, background: C.red, color: "#fff" }}>
                NOW BUILD YOURS →
              </button>
            </div>
          </section>
        )}

        {/* ---------- FREE WEEK 1 ---------- */}
        <section id="try" style={{ paddingTop: 64 }}>
          <div style={eyebrow}>FREE · WEEK 1</div>
          <h2 style={{ ...h2, marginBottom: 8 }}>
            Build your Week 1 — <span style={{ color: C.red }}>free</span>
          </h2>
          <p style={{ color: C.knurl, fontSize: 14.5, marginBottom: 22, maxWidth: 640 }}>
            Experience, days and your lifts (or a recent heavy set) — that's it. Injuries and recovery adjust the plan too.
          </p>
          <EngineGate />
        </section>

        {/* ---------- COACH ---------- */}
        <section id="coach" style={{ paddingTop: 64 }}>
          <div style={eyebrow}>YOUR COACH</div>
          <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <img
              src={CONFIG.coach.photo}
              alt={`${CONFIG.coach.name}, powerlifting coach`}
              width={441}
              height={552}
              loading="lazy"
              style={{ width: "min(220px, 42vw)", height: "auto", borderRadius: 12, border: `1px solid ${C.line}`, objectFit: "cover" }}
            />
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: "clamp(26px, 5vw, 34px)" }}>{CONFIG.coach.name}</h2>
              <p style={{ color: C.brass, marginTop: 4, fontSize: 15 }}>{CONFIG.coach.role}</p>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8 }}>
                {CONFIG.coach.points.map((t) => (
                  <li key={t} style={{ display: "flex", gap: 10, color: C.chalk, fontSize: 15, lineHeight: 1.45 }}>
                    <span style={{ color: C.red, flexShrink: 0 }}>●</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 18 }}>
            {CONFIG.coach.lifts.map((x) => (
              <div key={x.l} style={{ background: C.steel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 26 }}>
                  {x.v}<span style={{ color: C.red, fontSize: 14, marginLeft: 2 }}>{x.u}</span>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, color: C.knurl, marginTop: 4, textTransform: "uppercase" }}>{x.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- RESULTS (real athlete screenshots; hidden until there are some) ---------- */}
        {CONFIG.results?.length > 0 && (
          <section id="results" style={{ paddingTop: 64 }}>
            <div style={eyebrow}>RESULTS</div>
            <h2 style={h2}>From lifters using it</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {CONFIG.results.map((r) => (
                <figure key={r.img} style={{ margin: 0, background: C.steel, border: `1px solid ${C.lineSolid}`, borderRadius: 14, padding: 10 }}>
                  <img src={r.img} alt={r.caption} loading="lazy" style={{ width: "100%", height: "auto", borderRadius: 10, display: "block" }} />
                  <figcaption style={{ color: C.knurl, fontSize: 13.5, marginTop: 8 }}>{r.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ---------- PRICING ---------- */}
        <section id="pricing" style={{ paddingTop: 64 }}>
          <div style={eyebrow}>PRICING</div>
          <h2 style={{ ...h2, marginBottom: 8 }}>Iron Engine Pro</h2>
          <p style={{ color: C.knurl, fontSize: 14.5, marginBottom: 18, maxWidth: 680, lineHeight: 1.55 }}>
            Week 1 is free. Pro unlocks the full block, weekly check-ins that set next week's kg, a new block built from your logs every time one ends, and PDF + Excel export.
          </p>
          <div style={{ background: C.steel2, borderLeft: `3px solid ${C.brass}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, maxWidth: 720, fontSize: 14.5, lineHeight: 1.5 }}>
            <b style={{ color: C.chalk }}>1:1 coaching</b> <span style={{ color: C.knurl }}>is a monthly fee with limited spots. Iron Engine runs the same programming logic — without the coach's time — for a fraction of it, and no waiting list.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {plans.map((p) => {
              const perMonth = p.price / p.months;
              const save = Math.round((1 - p.price / (monthly * p.months)) * 100);
              return (
                <div
                  key={p.productName}
                  className="ll-card"
                  style={{
                    position: "relative",
                    background: p.popular ? `linear-gradient(160deg, ${C.redDim} 0%, ${C.steel} 70%)` : C.steel,
                    border: `1px solid ${p.popular ? C.red : C.lineSolid}`,
                    borderRadius: 14,
                    padding: "22px 18px 18px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {p.popular && (
                    <span style={{ position: "absolute", top: -11, left: 16, background: C.red, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, padding: "3px 10px", borderRadius: 20 }}>
                      MOST POPULAR
                    </span>
                  )}
                  <div style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontSize: 15, letterSpacing: 1, textTransform: "uppercase", color: C.knurl }}>{p.label}</div>
                  <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 30, marginTop: 6 }}>{rupees(p.price)}</div>
                  <div style={{ color: p.months > 1 ? C.brass : C.knurl, fontSize: 14, marginTop: 2, minHeight: 20 }}>
                    {p.months > 1 ? `${rupees(perMonth)} / month · save ${save}%` : "per month"}
                  </div>
                  <button
                    onClick={() => buy(p.productName)}
                    style={{ ...btnSmall, marginTop: 16, background: p.popular ? C.red : "transparent", color: p.popular ? "#fff" : C.chalk, border: p.popular ? "none" : `1px solid ${C.lineSolid}` }}
                  >
                    Choose {p.label} →
                  </button>
                </div>
              );
            })}
          </div>
          <p style={{ color: C.dim, fontSize: 13, marginTop: 14 }}>
            One-time payment via PayU (UPI / cards). No auto-debit — you choose if and when to renew.
          </p>
        </section>

        {/* ---------- GUIDE ---------- */}
        {guide && (
          <section id="guide" style={{ paddingTop: 64 }}>
            <div style={eyebrow}>PREFER TO LEARN IT YOURSELF?</div>
            <div
              className="ll-card"
              style={{ marginTop: 12, background: C.steel, border: `1px solid ${C.lineSolid}`, borderRadius: 14, padding: "20px", display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.red, letterSpacing: 1.5 }}>{guide.tag}</div>
                <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 19, marginTop: 6 }}>{guide.name}</div>
                <p style={{ color: C.knurl, fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>{guide.desc}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, color: C.brass, fontWeight: 600 }}>{guide.price}</span>
                <button onClick={() => buy(guide.productName)} style={{ ...btnSmall, background: C.red, color: "#fff", border: "none" }}>
                  {guide.cta} →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ---------- COACHING ---------- */}
        <section id="coaching" style={{ paddingTop: 64 }}>
          <div style={{ ...eyebrow, color: C.brass, marginBottom: 8 }}>PREMIUM · 1:1 COACHING</div>
          <div
            style={{
              background: `linear-gradient(135deg, #221A0B 0%, ${C.steel} 60%)`,
              border: `1px solid ${C.brass}`,
              borderRadius: 16,
              padding: "32px 24px",
            }}
          >
            <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: "clamp(24px, 5vw, 30px)" }}>1:1 Online Coaching</h2>
            <p style={{ color: C.chalk, fontSize: 15, marginTop: 10, maxWidth: 580, lineHeight: 1.6 }}>
              Want me in your corner? Personal programming, weekly video technique review, competition prep and direct access. Limited spots — beginners welcome. I reply personally on WhatsApp.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
              <a href={CONFIG.coachingFormUrl} target="_blank" rel="noreferrer" style={{ ...btnBig, background: C.brass, color: "#14161B", textDecoration: "none", fontSize: 15 }}>
                APPLY NOW →
              </a>
              <a
                href={CONFIG.instaUrl}
                target="_blank"
                rel="noreferrer"
                style={{ padding: "14px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 15 }}
              >
                DM @{CONFIG.insta}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ borderTop: `1px solid ${C.lineSolid}`, padding: "28px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 16 }}>
          LALIT<span style={{ color: C.red }}>LIFTS</span>
        </div>
        <div style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>
          {CONFIG.tagline} ·{" "}
          <a href={CONFIG.instaUrl} target="_blank" rel="noreferrer" style={{ color: C.knurl }}>
            @{CONFIG.insta}
          </a>
        </div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 10, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/terms" style={{ color: C.dim }}>Terms</Link>
          <Link to="/privacy-policy" style={{ color: C.dim }}>Privacy</Link>
          <Link to="/refund-policy" style={{ color: C.dim }}>Refunds</Link>
          <Link to="/disclaimer" style={{ color: C.dim }}>Disclaimer</Link>
          <Link to="/contact" style={{ color: C.dim }}>Contact</Link>
        </div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 10, maxWidth: 620, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
          Disclaimer: All content and tools on this site are for educational
          purposes only and do not constitute medical advice. Consult a
          qualified professional before starting any training program. Train at
          your own risk.
        </div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>
          © {new Date().getFullYear()} LalitLifts. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* ---------- Example: three phone screens from one real engine block ---------- */
function Phone({ title, children }) {
  return (
    <div
      style={{
        background: "#0B0D11",
        border: `1px solid ${C.lineSolid}`,
        borderRadius: 28,
        padding: "14px 12px 16px",
        boxShadow: "0 18px 40px rgba(0,0,0,.35)",
        maxWidth: 330,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div aria-hidden="true" style={{ width: 70, height: 5, borderRadius: 4, background: C.lineSolid, margin: "0 auto 12px" }} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.red, letterSpacing: 2, marginBottom: 10, paddingLeft: 4 }}>{title}</div>
      <div style={{ background: C.steel, borderRadius: 16, padding: "14px 14px", minHeight: 300 }}>{children}</div>
    </div>
  );
}

function SamplePhones({ program }) {
  const weeks = program.weeks || [];
  const day = weeks[0]?.days?.find((d) => !d.rest && !d.optional);
  // The engine's own coaching notes ("why this plan"), minus calendar/start-date lines.
  const why = (program.notes || [])
    .filter((n) => /^(Squat|Deadlift|Accessories|Volume)/.test(n))
    .map((n) => n.replace(/\s*\(Helms[^)]*\)/, "").replace(/ Arm, shoulder.*$/, ""))
    .slice(0, 3);
  const small = { color: C.knurl, fontSize: 12.5, lineHeight: 1.45 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
      <Phone title="YOUR BLOCK">
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 16 }}>{program.blockLabel}</div>
        <div style={{ ...small, marginTop: 4 }}>{program.freq}</div>
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {weeks.map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.steel2, borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${w.deload ? C.brass : C.red}` }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{w.label}</span>
              <span style={{ ...small, fontSize: 12 }}>{w.deload ? "Deload — recover" : `${w.days.filter((d) => !d.rest).length} sessions`}</span>
            </div>
          ))}
        </div>
        <div style={{ ...small, marginTop: 12 }}>Rest days: {(program.restDays || []).map((d) => d.slice(0, 3)).join(", ")}</div>
      </Phone>

      {day && (
        <Phone title="TODAY'S SESSION">
          <div style={{ ...small, textTransform: "uppercase", letterSpacing: 1 }}>{day.weekday} · Week 1</div>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 16, marginTop: 4 }}>{day.title}</div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {day.main.map((m, i) => (
              <div key={i} style={{ background: C.steel2, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, marginTop: 3 }}>
                  {m.sets} × {m.reps}
                  {m.kg ? <span style={{ color: C.brass }}> · {m.kg} kg</span> : null}
                  <span style={{ color: C.knurl }}> · {m.rpe}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {day.acc.slice(0, 3).map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, ...small, padding: "3px 0" }}>
                <span>{a.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{a.sr}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, background: C.red, color: "#fff", textAlign: "center", borderRadius: 10, padding: "10px", fontWeight: 700, fontSize: 14 }}>Start session</div>
        </Phone>
      )}

      {why.length > 0 && (
        <Phone title="WHY THIS PLAN">
          <div style={{ display: "grid", gap: 10 }}>
            {why.map((n, i) => (
              <p key={i} style={{ ...small, fontSize: 13, color: C.chalk, margin: 0, background: C.steel2, borderRadius: 10, padding: "10px 12px" }}>{n}</p>
            ))}
          </div>
          <div style={{ ...small, marginTop: 12 }}>Every block explains its decisions — no black box.</div>
        </Phone>
      )}
    </div>
  );
}

const eyebrow = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  color: C.red,
  letterSpacing: 2.5,
};
const h2 = {
  fontFamily: "'Archivo Black', sans-serif",
  fontSize: "clamp(26px, 5vw, 34px)",
  marginTop: 8,
  marginBottom: 14,
};
const navBtn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: C.knurl,
  cursor: "pointer",
  fontFamily: "'Barlow Semi Condensed', sans-serif",
  fontWeight: 600,
  fontSize: 14,
};
const btnBig = {
  padding: "15px 28px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontFamily: "'Archivo Black', sans-serif",
  fontSize: 15,
  letterSpacing: 1,
};
const btnSmall = {
  padding: "11px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
};
