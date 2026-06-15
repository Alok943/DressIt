// 8-screen quiz from QUIZ_DESIGN.md. Each card maps to canonical schema values.
// A product passes an answer if the product's value(s) for `dim` intersect the card's `values`.

export const COLOR_BUCKETS = {
  neutrals: ["black", "white", "grey", "beige", "cream"],
  earthy: ["olive", "brown", "khaki", "maroon", "mustard"],
  blues: ["blue", "navy", "teal"],
  bold: ["red", "pink", "orange", "purple", "lavender", "yellow", "green", "peach", "multi"],
};

export const QUESTIONS = [
  {
    // unisex items match BOTH choices, so a unisex hoodie shows for men and women alike
    id: "gender", dim: "gender", prompt: "Who are we styling?", kind: "single",
    cards: [
      { label: "Men", values: ["men", "unisex"], emoji: "🧍‍♂️" },
      { label: "Women", values: ["women", "unisex"], emoji: "🧍‍♀️" },
    ],
  },
  {
    // MEN's categories — shown only when gender = men. Same id as the women's
    // variant below, so only one ever appears and downstream (sleeve, filter) is unaffected.
    id: "category", dim: "category", prompt: "What are you after?", kind: "single",
    showIf: (a) => (a.gender?.values || []).includes("men"),
    cards: [
      { label: "Shirts", values: ["shirt"], emoji: "👔", subtitle: "Collar shirts, button-ups" },
      { label: "T-shirts", values: ["tshirt"], emoji: "👕", subtitle: "Crew neck, V-neck, round neck" },
      { label: "Polos", values: ["polo"], emoji: "🎽", subtitle: "Collar tee, sporty or smart-casual" },
      { label: "Jeans & Trousers", values: ["jeans", "trousers", "cargo", "shorts"], emoji: "👖", subtitle: "Bottoms: jeans, cargo, shorts" },
      { label: "Winter wear", values: ["jacket", "sweater", "hoodie", "sweatshirt", "joggers"], emoji: "🧥", subtitle: "Jackets, hoodies, sweaters" },
    ],
  },
  {
    // WOMEN's categories — shown only when gender = women.
    id: "category", dim: "category", prompt: "What are you after?", kind: "single",
    showIf: (a) => (a.gender?.values || []).includes("women"),
    cards: [
      { label: "Tops", values: ["top", "tshirt", "shirt", "polo"], emoji: "👚", subtitle: "T-shirts, shirts, casual tops" },
      { label: "Dresses & Co-ords", values: ["dress", "coord", "skirt"], emoji: "👗", subtitle: "Dresses, skirts, matching sets" },
      { label: "Bottoms", values: ["jeans", "trousers", "cargo", "shorts", "joggers"], emoji: "👖", subtitle: "Jeans, trousers, joggers" },
      { label: "Winter wear", values: ["jacket", "sweater", "hoodie", "sweatshirt"], emoji: "🧥", subtitle: "Jackets, hoodies, sweaters" },
    ],
  },
  {
    id: "occasion", dim: "occasion", prompt: "Where's this headed?", kind: "single",
    cards: [
      { label: "Chill", values: ["casual"], emoji: "🛋️", subtitle: "Home, errands, weekends" },
      { label: "Smart", values: ["smart_casual", "work"], emoji: "✨", subtitle: "Office, polished casual" },
      { label: "Night out", values: ["party", "street"], emoji: "🌃", subtitle: "Parties, events, going out" },
      { label: "Sharp", values: ["formal", "festive"], emoji: "🎯", subtitle: "Weddings, formal occasions" },
    ],
  },
  {
    id: "fit", dim: "fit", prompt: "How should it fit?", kind: "single",
    cards: [
      { label: "Slim fit", values: ["slim", "skinny", "muscle"], emoji: "📏", subtitle: "Fits close to the body — tailored, flattering look" },
      { label: "Regular / Straight", values: ["regular", "straight", "tapered"], emoji: "👌", subtitle: "Classic cut for most builds — not tight, not loose" },
      { label: "Oversized / Baggy", values: ["relaxed", "oversized", "baggy"], emoji: "🌊", subtitle: "Roomy and relaxed — the modern streetwear silhouette" },
    ],
  },
  {
    id: "pattern", dim: "pattern", prompt: "Plain, or with personality?", kind: "single",
    cards: [
      { label: "Solid", values: ["solid"], emoji: "⬜", subtitle: "One clean colour, no pattern" },
      { label: "Textured / Washed", values: ["textured", "washed"], emoji: "🌫️", subtitle: "Subtle surface detail or washed finish" },
      { label: "Stripes", values: ["stripe"], emoji: "📊", subtitle: "Vertical, horizontal or diagonal lines" },
      { label: "Checks", values: ["check"], emoji: "🏁", subtitle: "Gingham, plaid, flannel" },
      { label: "Printed / Graphic", values: ["print", "floral", "graphic", "camo", "colorblock", "embroidery"], emoji: "🎨", subtitle: "Florals, graphics, camo, colour-block" },
    ],
  },
  {
    id: "color", dim: "color", prompt: "Your palette? (tap any)", kind: "multi", soft: true,
    cards: [
      { label: "Neutrals", values: COLOR_BUCKETS.neutrals, emoji: "🤍" },
      { label: "Earthy", values: COLOR_BUCKETS.earthy, emoji: "🌿" },
      { label: "Blues", values: COLOR_BUCKETS.blues, emoji: "💙" },
      { label: "Bold", values: COLOR_BUCKETS.bold, emoji: "🔥" },
    ],
  },
  {
    id: "band", dim: "band", prompt: "Budget comfort?", kind: "single",
    cards: [
      { label: "Under ₹1.2k", values: ["budget"], emoji: "💸" },
      { label: "₹1.2k–2k", values: ["mid"], emoji: "💵" },
      { label: "Premium", values: ["premium"], emoji: "💎" },
    ],
  },
  {
    id: "sleeve", dim: "sleeve", prompt: "Sleeve mood?", kind: "single", soft: true,
    showIf: (a) => ["shirt", "tshirt", "polo"].some((c) => (a.category?.values || []).includes(c)),
    cards: [
      { label: "Half", values: ["half"], emoji: "🩳" },
      { label: "Full", values: ["full"], emoji: "🧤" },
      { label: "No preference", values: [], emoji: "🤷", skip: true },
    ],
  },
  {
    id: "fabric", dim: "fabric", prompt: "Fabric feel?", kind: "single", soft: true,
    cards: [
      { label: "Breezy", values: ["linen", "cotton"], emoji: "🍃", subtitle: "Cotton & linen — light, airy" },
      { label: "Structured", values: ["denim", "twill", "oxford"], emoji: "🧱", subtitle: "Denim & twill — holds its shape" },
      { label: "Cozy", values: ["knit", "fleece", "wool", "terry"], emoji: "🧶", subtitle: "Knit & fleece — warm, soft" },
      { label: "No preference", values: [], emoji: "🤷", skip: true },
    ],
  },
];

export const FORK_AFTER = 5; // after color (gender Q0 shifted everything +1); fork before band/sleeve/fabric
