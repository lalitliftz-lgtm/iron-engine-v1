// ============================================================
//  ENGINE GATE (landing) — free Week-1 sample, always open.
//  "Get Access" routes into the REAL auth + PayU checkout
//  (no static access code — the backend grants access on payment).
// ============================================================
import { useNavigate } from "react-router-dom";
import { CONFIG } from "../../config/siteConfig";
import { C } from "../../lib/engine";
import { IronEngine } from "./EngineUI";

export default function EngineGate() {
  const navigate = useNavigate();
  const engine = CONFIG.products.find((p) => p.id === "engine");

  // Send visitors into the account flow; after signup they land on the
  // subscription page pre-targeted at Iron Engine Pro, which triggers
  // /api/payments/create-order (PayU).
  const goBuy = () =>
    navigate(
      `/signup?next=${encodeURIComponent(
        "/dashboard/subscription"
      )}&product=${encodeURIComponent(engine.productName)}`
    );

  return (
    <div>
      {/* Upgrade strip */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.redDim} 0%, ${C.steel} 65%)`,
          border: `1px solid ${C.red}`,
          borderRadius: 14,
          padding: "22px 22px",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 20,
              }}
            >
              Full Access —{" "}
              <span style={{ color: C.brass }}>{engine.price}</span>
            </div>
            <div
              style={{
                color: C.knurl,
                fontSize: 13.5,
                marginTop: 4,
                maxWidth: 480,
              }}
            >
              Full 4-week blocks · sticking-point analysis · unlimited blocks
              · block focus · unlimited programs · Excel + PDF export · saved to
              your account
            </div>
          </div>
          <button
            onClick={goBuy}
            style={{
              padding: "13px 26px",
              borderRadius: 10,
              background: C.red,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 15,
              letterSpacing: 1,
              whiteSpace: "nowrap",
            }}
          >
            GET ACCESS →
          </button>
        </div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: C.dim }}>
          Already a member?{" "}
          <button
            onClick={() => navigate("/login")}
            style={{
              background: "none",
              border: "none",
              color: C.brass,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12.5,
              padding: 0,
            }}
          >
            Log in →
          </button>
        </div>
      </div>

      {/* Free sample */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            background: C.brass,
            color: "#14161B",
            padding: "3px 10px",
            borderRadius: 20,
            fontWeight: 800,
            letterSpacing: 1.5,
          }}
        >
          FREE SAMPLE
        </span>
        <span style={{ color: C.knurl, fontSize: 13.5 }}>
          Try the engine — generate Week 1 of a real program, no login needed.
        </span>
      </div>
      <IronEngine full={false} onUpgrade={goBuy} />
    </div>
  );
}
