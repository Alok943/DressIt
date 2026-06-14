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
      { label: "Shirts", values: ["shirt"], emoji: "👔" },
      { label: "T-shirts", values: ["tshirt"], emoji: "👕" },
      { label: "Polos", values: ["polo"], emoji: "🎽" },
      { label: "Jeans & Trousers", values: ["jeans", "trousers", "cargo", "shorts"], emoji: "👖" },
      { label: "Winter wear", values: ["jacket", "sweater", "hoodie", "sweatshirt", "joggers"], emoji: "🧥" },
    ],
  },
  {
    // WOMEN's categories — shown only when gender = women.
    id: "category", dim: "category", prompt: "What are you after?", kind: "single",
    showIf: (a) => (a.gender?.values || []).includes("women"),
    cards: [
      { label: "Tops", values: ["top", "tshirt", "shirt", "polo"], emoji: "👚" },
      { label: "Dresses & Co-ords", values: ["dress", "coord", "skirt"], emoji: "👗" },
      { label: "Bottoms", values: ["jeans", "trousers", "cargo", "shorts", "joggers"], emoji: "👖" },
      { label: "Winter wear", values: ["jacket", "sweater", "hoodie", "sweatshirt"], emoji: "🧥" },
    ],
  },
  {
    id: "occasion", dim: "occasion", prompt: "Where's this headed?", kind: "single",
    cards: [
      { label: "Chill", values: ["casual"], emoji: "🛋️" },
      { label: "Smart", values: ["smart_casual", "work"], emoji: "✨" },
      { label: "Night out", values: ["party", "street"], emoji: "🌃" },
      { label: "Sharp", values: ["formal", "festive"], emoji: "🎯" },
    ],
  },
  {
    id: "fit", dim: "fit", prompt: "How do you like it to sit?", kind: "single",
    cards: [
      { label: "Fitted", values: ["slim", "skinny", "muscle"], emoji: "📏" },
      { label: "True to size", values: ["regular", "straight", "tapered"], emoji: "👌" },
      { label: "Loose", values: ["relaxed", "oversized", "baggy"], emoji: "🌊" },
    ],
  },
  {
    id: "pattern", dim: "pattern", prompt: "Plain, or with personality?", kind: "single",
    cards: [
      { label: "Clean", values: ["solid"], emoji: "⬜" },
      { label: "Texture", values: ["textured", "washed"], emoji: "🌫️" },
      { label: "Stripes", values: ["stripe"], emoji: "📊" },
      { label: "Checks", values: ["check"], emoji: "🏁" },
      { label: "Printed", values: ["print", "floral", "graphic", "camo", "colorblock", "embroidery"], emoji: "🎨" },
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
      { label: "Breezy", values: ["linen", "cotton"], emoji: "🍃" },
      { label: "Structured", values: ["denim", "twill", "oxford"], emoji: "🧱" },
      { label: "Cozy", values: ["knit", "fleece", "wool", "terry"], emoji: "🧶" },
      { label: "No preference", values: [], emoji: "🤷", skip: true },
    ],
  },
];

export const FORK_AFTER = 5; // after color (gender Q0 shifted everything +1); fork before band/sleeve/fabric
