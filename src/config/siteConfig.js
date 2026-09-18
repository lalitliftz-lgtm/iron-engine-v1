// ============================================================
//  LALITLIFTS — SITE CONFIG
//  Lalit, edit everything here: brand, prices, product routing.
//  `productId` on each item maps to a row in the `products` table
//  (supabase_schema.sql) so checkout uses the real Razorpay flow.
// ============================================================
export const CONFIG = {
  brand: "LALITLIFTS",
  insta: "lalit_lifts_",
  instaUrl: "https://instagram.com/lalit_lifts_",
  tagline: "Science-Based Powerlifting. No Bro-Science.",
  credentials:
    "State & District Gold Medalist · All India Inter-University Powerlifter",
  coachingFormUrl: "#", // 👈 your Google Form link for 1:1 coaching applications

  products: [
    {
      id: "guide1",
      // 👇 must match products.name in Supabase for checkout to resolve
      productName: "All About Powerlifting System",
      type: "pdf_guide",
      tag: "GUIDE · PDF",
      name: "All About Powerlifting System",
      desc: "Basic to Advanced — technique, programming logic, fatigue management, and block design. Learn to build your own programs.",
      mrp: "₹2,999",
      price: "₹999",
      cta: "Buy Guide",
    },
    {
      id: "guide2",
      productName: "Learn Lift Eat & Repeat",
      type: "pdf_guide",
      tag: "GUIDE · PDF",
      name: "Learn Lift Eat & Repeat",
      desc: "The complete science of muscle building and fat loss — training, nutrition, macros. No fluff, only what actually works.",
      mrp: "₹1,999",
      price: "₹699",
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
      price: "₹1,999 / year",
      cta: "Try Free Sample",
      locked: true,
    },
    {
      id: "coaching",
      productName: null, // handled via application form, not checkout
      type: "application",
      tag: "PREMIUM · 1:1",
      name: "1:1 Online Coaching",
      desc: "Personal programming, weekly video technique review, competition prep, and direct access. Serious lifters only — by application.",
      mrp: "",
      price: "Apply",
      cta: "Apply Now",
    },
  ],
};
