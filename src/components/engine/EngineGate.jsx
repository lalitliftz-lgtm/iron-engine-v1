// ============================================================
//  ENGINE GATE (landing) — free Week-1 sample, always open.
//  "Unlock" routes into the real sign-up + PayU checkout (the backend grants
//  access on payment). Prices live in the landing page's Pricing section.
// ============================================================
import { useNavigate } from "react-router-dom";
import { CONFIG } from "../../config/siteConfig";
import { C } from "../../lib/engine";
import { IronEngine } from "./EngineUI";

export default function EngineGate() {
  const navigate = useNavigate();
  const engine = CONFIG.products.find((p) => p.id === "engine");

  // After sign-up they land on the subscription page pre-targeted at Iron Engine Pro (PayU checkout).
  const goBuy = () =>
    navigate(
      `/signup?next=${encodeURIComponent(
        "/dashboard/subscription"
      )}&product=${encodeURIComponent(engine.productName)}`
    );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
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
          FREE · NO LOGIN
        </span>
        <span style={{ color: C.knurl, fontSize: 13.5 }}>
          3 short steps → Week 1 of your real program.
        </span>
      </div>
      <IronEngine full={false} onUpgrade={goBuy} />
    </div>
  );
}
