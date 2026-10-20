// ============================================================
//  LALITLIFTS — SITE CONFIG
//  Lalit, edit everything here: brand, prices, product routing.
//  `productName` on each item must match a row in the Supabase `products`
//  table (accounts, data, prices); checkout runs on PayU.
// ============================================================
export const CONFIG = {
  brand: "LALITLIFTS",
  site: "lalitlifts.online",
  supportEmail: "lalitliftz@gmail.com", // 👈 shown on the Contact page — change when you have a domain email
  insta: "lalit_lifts1",
  instaUrl: "https://instagram.com/lalit_lifts1",
  tagline: "Science-Based Powerlifting. No Bro-Science.",
  credentials:
    "State & District Gold Medalist · All India Inter-University Powerlifter",
  // "Meet your coach" section on the landing page. Photo lives in /public.
  coach: {
    name: "Lalit",
    role: "Strength & Conditioning Coach · State Gold Medalist",
    photo: "/coach-lalit.jpg",
    points: [
      "5+ years of training experience",
      "Coaching clients — every current client has hit a PR",
      "This system was built with them, on evidence-based training principles",
    ],
    lifts: [
      { v: "175", u: "kg", l: "Squat" },
      { v: "110", u: "kg+", l: "Bench" },
      { v: "200", u: "kg", l: "Deadlift" },
      { v: "66", u: "kg", l: "Bodyweight" },
    ],
  },
  // "Results" on the landing page — real screenshots from lifters (wins / PR screens), put in /public.
  // The section stays hidden while this list is empty. Example:
  // { img: "/results/rahul-squat-pr.jpg", caption: "Rahul · squat 140 → 150 kg in one block" },
  results: [],
  // 1:1 coaching applications open WhatsApp with this draft already typed — the lifter fills the blanks and sends.
  whatsapp: "918279951257", // 👈 country code + number, no + or spaces
  coachingMessage: [
    "Hi Lalit! I want to apply for 1:1 Online Coaching.",
    "",
    "Name:",
    "Age / Bodyweight:",
    "Training experience (years):",
    "Best lifts — Squat / Bench / Deadlift:",
    "Training days per week:",
    "Goal (meet / strength / muscle):",
    "Any injuries or pain:",
    "",
    "(Sent from the LalitLifts website)",
  ].join("\n"),

  // Iron Engine Pro plans. `productName` must match products.name in Supabase; the database price is what PayU
  // charges and products.duration_days is how long access lasts — keep these display prices in sync with it.
  proPlans: [
    { productName: "Iron Engine Pro", label: "1 Month", months: 1, price: 1499 },
    { productName: "Iron Engine Pro — 3 Months", label: "3 Months", months: 3, price: 3499, popular: true },
    { productName: "Iron Engine Pro — 6 Months", label: "6 Months", months: 6, price: 5999 },
    { productName: "Iron Engine Pro — 1 Year", label: "1 Year", months: 12, price: 9999, best: true },
  ],

  products: [
    {
      id: "system2",
      // 👇 must match products.name in Supabase for checkout to resolve
      productName: "Powerlifting System 2.0",
      type: "pdf_guide",
      tag: "NEW · GUIDE · PDF",
      name: "Powerlifting System 2.0",
      desc: "The evolved version of the original system — 16 chapters + worksheets: volume & progression, periodization, fatigue & deloads, weak-point diagnostics, technique in detail, build your own program with worked examples, and meet prep & peaking.",
      mrp: "",
      price: "₹1,499",
      cta: "Buy Guide",
    },
    {
      id: "engine",
      productName: "Iron Engine Pro",
      type: "subscription",
      tag: "TOOL · WEB APP",
      name: "Iron Engine — Program Builder",
      desc: "Generate personalized 4-week powerlifting blocks — sticking-point analysis, injury-aware, recovery-adjusted. Unlimited programs, Excel + PDF export.",
      mrp: "",
      price: "₹1,499 / month · ₹9,999 / year",
      cta: "Try Free Sample",
      locked: true,
    },
    {
      id: "coaching",
      productName: null, // handled via application form, not checkout
      type: "application",
      tag: "PREMIUM · 1:1",
      name: "1:1 Online Coaching",
      desc: "Personal programming, weekly video technique review, competition prep, and direct access. Beginners welcome — Lalit replies personally on WhatsApp.",
      mrp: "",
      price: "Apply",
      cta: "Apply Now",
    },
  ],
};

// WhatsApp link for coaching applications (draft message pre-filled).
CONFIG.coachingFormUrl = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.coachingMessage)}`;
