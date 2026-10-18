// ============================================================
//  LANDING — public storefront (dark, LalitLifts branding)
//  Hero · 4 products · real Iron Engine (free sample) · coaching.
//  Product CTAs route into the real Supabase auth + checkout flow.
// ============================================================
import { useNavigate, Link } from "react-router-dom";
import { CONFIG } from "../config/siteConfig";
import { C } from "../lib/engine";
import EngineGate from "../components/engine/EngineGate";

export default function Landing() {
  const navigate = useNavigate();
  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  // Route a product into the account/checkout flow.
  const buyProduct = (p) =>
    navigate(
      `/signup?next=${encodeURIComponent(
        "/dashboard/subscription"
      )}&product=${encodeURIComponent(p.productName)}`
    );

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
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 18,
              letterSpacing: 0.5,
            }}
          >
            LALIT<span style={{ color: C.red }}>LIFTS</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              ["Products", "products"],
              ["Iron Engine", "engine"],
              ["Coaching", "coaching"],
            ].map(([l, id]) => (
              <button
                key={id}
                className="ll-nav-scroll"
                onClick={() => scrollTo(id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: C.knurl,
                  cursor: "pointer",
                  fontFamily: "'Barlow Semi Condensed', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {l}
              </button>
            ))}
            <Link
              to="/login"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                color: C.chalk,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: C.red,
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------- HERO ---------- */}
      <header
        style={{
          position: "relative",
          padding: "76px 20px 68px",
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
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              color: C.red,
              letterSpacing: 2.5,
              marginBottom: 12,
            }}
          >
            @{CONFIG.insta.toUpperCase()} · COMPETITIVE POWERLIFTER
          </div>
          <h1
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "clamp(42px, 9vw, 78px)",
              lineHeight: 0.95,
              letterSpacing: -1.5,
            }}
          >
            LALIT<span style={{ color: C.red }}>LIFTS</span>
          </h1>
          <p
            style={{
              fontSize: "clamp(17px, 3vw, 23px)",
              color: C.chalk,
              marginTop: 16,
              fontWeight: 600,
            }}
          >
            {CONFIG.tagline}
          </p>
          <p
            style={{
              color: C.brass,
              marginTop: 10,
              fontSize: 14,
              maxWidth: 560,
              fontFamily: "'Barlow Semi Condensed', sans-serif",
              letterSpacing: 0.5,
            }}
          >
            {CONFIG.credentials}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            <button
              onClick={() => scrollTo("engine")}
              style={{
                padding: "15px 30px",
                borderRadius: 10,
                border: "none",
                background: C.red,
                color: "#fff",
                cursor: "pointer",
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 15,
                letterSpacing: 1,
              }}
            >
              BUILD MY FREE PROGRAM →
            </button>
            <button
              onClick={() => scrollTo("products")}
              style={{
                padding: "15px 30px",
                borderRadius: 10,
                border: `1px solid ${C.brass}`,
                background: "transparent",
                color: C.brass,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
                fontFamily: "'Barlow', sans-serif",
              }}
            >
              Guides & coaching
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1020, margin: "0 auto", padding: "0 20px 80px" }}>
        {/* ---------- PRODUCTS ---------- */}
        <section id="products" style={{ paddingTop: 60 }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              color: C.red,
              letterSpacing: 2.5,
            }}
          >
            01 / PRODUCTS
          </div>
          <h2
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "clamp(26px, 5vw, 34px)",
              marginTop: 8,
              marginBottom: 26,
            }}
          >
            The Complete Strength System
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {CONFIG.products.map((p) => (
              <div
                key={p.id}
                className="ll-card"
                style={{
                  background: C.steel,
                  borderRadius: 14,
                  padding: "22px 20px",
                  display: "flex",
                  flexDirection: "column",
                  border: `1px solid ${C.lineSolid}`,
                  borderTop: `3px solid ${
                    p.id === "engine"
                      ? C.red
                      : p.id === "coaching"
                      ? C.brass
                      : C.lineSolid
                  }`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    color: p.id === "coaching" ? C.brass : C.red,
                    letterSpacing: 1.5,
                    marginBottom: 10,
                  }}
                >
                  {p.tag}
                  {p.locked ? " · 🔒" : ""}
                </div>
                <div
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: 19,
                    lineHeight: 1.15,
                    marginBottom: 10,
                  }}
                >
                  {p.name}
                </div>
                <p style={{ color: C.knurl, fontSize: 14, lineHeight: 1.55, flex: 1 }}>
                  {p.desc}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 18,
                    gap: 10,
                  }}
                >
                  <span
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}
                  >
                    {p.mrp && (
                      <s style={{ color: C.dim, fontSize: 13, marginRight: 8 }}>
                        {p.mrp}
                      </s>
                    )}
                    <span style={{ color: C.brass, fontWeight: 600 }}>{p.price}</span>
                  </span>
                  {p.id === "engine" ? (
                    <button
                      onClick={() => scrollTo("engine")}
                      style={btnRed}
                    >
                      {p.cta} →
                    </button>
                  ) : p.id === "coaching" ? (
                    <a
                      href={CONFIG.coachingFormUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...btnBrassOutline, textDecoration: "none" }}
                    >
                      {p.cta} →
                    </a>
                  ) : (
                    <button onClick={() => buyProduct(p)} style={btnRed}>
                      {p.cta} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- IRON ENGINE ---------- */}
        <section id="engine" style={{ paddingTop: 68 }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              color: C.red,
              letterSpacing: 2.5,
            }}
          >
            02 / TOOL · FREE SAMPLE AVAILABLE
          </div>
          <h2
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "clamp(26px, 5vw, 34px)",
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            IRON<span style={{ color: C.red }}>ENGINE</span> — Program Builder
          </h2>
          <p
            style={{
              color: C.knurl,
              fontSize: 14.5,
              marginBottom: 24,
              maxWidth: 640,
            }}
          >
            3 steps → a personalized 4-week powerlifting block. Sticking-point
            analysis, injury-aware exercise swaps, recovery-adjusted volume,
            built-in deload, Excel + PDF export.
          </p>
          <EngineGate />
        </section>

        {/* ---------- COACHING ---------- */}
        <section id="coaching" style={{ paddingTop: 68 }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              color: C.brass,
              letterSpacing: 2.5,
              marginBottom: 8,
            }}
          >
            03 / PREMIUM · 1:1 COACHING
          </div>
          <div
            style={{
              background: `linear-gradient(135deg, #221A0B 0%, ${C.steel} 60%)`,
              border: `1px solid ${C.brass}`,
              borderRadius: 16,
              padding: "36px 26px",
            }}
          >
            <h2
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(24px, 5vw, 30px)",
              }}
            >
              1:1 Online Coaching
            </h2>
            <p
              style={{
                color: C.chalk,
                fontSize: 15,
                marginTop: 10,
                maxWidth: 580,
                lineHeight: 1.6,
              }}
            >
              Personal programming, weekly video technique review, competition
              prep, and direct access. The guides and tools build your
              foundation — coaching delivers the results. Beginners welcome; Lalit replies personally on WhatsApp.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
              <a
                href={CONFIG.coachingFormUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "14px 28px",
                  borderRadius: 10,
                  background: C.brass,
                  color: "#14161B",
                  textDecoration: "none",
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: 15,
                  letterSpacing: 1,
                }}
              >
                APPLY NOW →
              </a>
              <a
                href={CONFIG.instaUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "14px 28px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.3)",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                DM @{CONFIG.insta}
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer
        style={{
          borderTop: `1px solid ${C.lineSolid}`,
          padding: "28px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 16 }}>
          LALIT<span style={{ color: C.red }}>LIFTS</span>
        </div>
        <div style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>
          Science-based powerlifting ·{" "}
          <a
            href={CONFIG.instaUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: C.knurl }}
          >
            @{CONFIG.insta}
          </a>
        </div>
        <div
          style={{
            color: C.dim,
            fontSize: 12,
            marginTop: 10,
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link to="/terms" style={{ color: C.dim }}>Terms</Link>
          <Link to="/privacy-policy" style={{ color: C.dim }}>Privacy</Link>
          <Link to="/refund-policy" style={{ color: C.dim }}>Refunds</Link>
          <Link to="/disclaimer" style={{ color: C.dim }}>Disclaimer</Link>
          <Link to="/contact" style={{ color: C.dim }}>Contact</Link>
        </div>
        <div
          style={{
            color: C.dim,
            fontSize: 12,
            marginTop: 10,
            maxWidth: 620,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.5,
          }}
        >
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

const btnRed = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: C.red,
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
};
const btnBrassOutline = {
  padding: "10px 18px",
  borderRadius: 8,
  border: `1px solid ${C.brass}`,
  background: "transparent",
  color: C.brass,
  cursor: "pointer",
  fontWeight: 700,
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
};
