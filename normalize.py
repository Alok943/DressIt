"""
Dressit tag normalizer.
Raw Shopify product (feed JSON) -> clean attribute dict on a fixed schema.

Schema dimensions:
  category  (from product_type — reliable)
  fit, color, sleeve, pattern, fabric, occasion  (from tags, best-effort)

This output doubles as GROUND TRUTH for validating the VLM tagger:
the high-precision dims (fit/color/sleeve/pattern/fabric/category) are trustworthy;
occasion is noisy in tags and is treated as weak ground truth only.
"""
import json, re
from collections import Counter

# ---- category: product_type -> canonical ----
CATEGORY = {
    "shirts":"shirt","shirt":"shirt","overshirt":"shirt",
    "t-shirts":"tshirt","t-shirt":"tshirt","tshirt":"tshirt",
    "polo":"polo",
    "trousers":"trousers","chinos":"trousers",
    "jeans":"jeans",
    "cargo pants":"cargo","cargo":"cargo",
    "shorts":"shorts",
    "jackets":"jacket","jacket":"jacket",
    "sweaters":"sweater","sweater":"sweater","sweatshirts":"sweatshirt",
    "hoodie":"hoodie","hoodies":"hoodie",
    "joggers & trackpants":"joggers",
    "shoes":"shoes","shoes and loafers":"shoes","sneakers":"shoes",
    "accessories":"accessory","sunglasses":"accessory","belts":"accessory",
    "cap":"accessory","socks":"accessory",
}

# ---- tag vocab: substring (lowercased, spaces stripped for matching) -> canonical ----
# matching is done on BOTH the spaced and despaced tag so "Regular Fit" and "PoloRegularFit" both hit.
DIMS = {
 "fit": {"oversized":"oversized","oversize":"oversized","boxfit":"oversized","boxy":"oversized",
         "regularfit":"regular","relaxedfit":"relaxed","relaxfit":"relaxed","relaxed":"relaxed",
         "slimfit":"slim","slim":"slim","baggy":"baggy","straightfit":"straight","skinny":"skinny",
         "muscle":"muscle","tapered":"tapered","camp shirt":"relaxed","campshirt":"relaxed"},
 "occasion": {"formal":"formal","clubwear":"party","party":"party","smartcasual":"smart_casual",
              "brunch":"smart_casual","dinnerdate":"smart_casual","datenight":"smart_casual",
              "casual":"casual","collegewear":"casual","everyday":"casual","streetwear":"street",
              "street":"street","gym":"active","activewear":"active","sport":"active",
              "lounge":"lounge","work":"work","office":"work","wedding":"festive","festive":"festive",
              "travel":"travel","winterlayering":"winter","beach":"vacation","vacation":"vacation"},
 "color": {"black":"black","white":"white","navy":"navy","blue":"blue","olive":"olive","green":"green",
           "red":"red","pink":"pink","beige":"beige","brown":"brown","grey":"grey","gray":"grey",
           "maroon":"maroon","yellow":"yellow","orange":"orange","purple":"purple","lavender":"lavender",
           "cream":"cream","khaki":"khaki","burgundy":"burgundy","teal":"teal","mustard":"mustard",
           "peach":"peach","wine":"maroon"},
 "sleeve": {"halfsleeve":"half","shortsleeve":"half","fullsleeve":"full","longsleeve":"full",
            "sleeveless":"sleeveless"},
 "pattern": {"plain":"solid","solid":"solid","selfdesign":"solid","check":"check","stripe":"stripe",
             "print":"print","abstract":"print","floral":"floral","graphic":"graphic",
             "embroider":"embroidery","textured":"textured","washed":"washed","faded":"washed",
             "colourblock":"colorblock","colorblock":"colorblock","camo":"camo","tie&dye":"print",
             "tiedye":"print","flannel":"check"},
 "fabric": {"cotton":"cotton","linen":"linen","denim":"denim","poly":"polyester","nylon":"nylon",
            "rayon":"rayon","viscose":"viscose","wool":"wool","leather":"leather","corduroy":"corduroy",
            "satin":"satin","silk":"silk","terry":"terry","fleece":"fleece","knit":"knit",
            "twill":"twill","oxford":"oxford","oxfords":"oxford"},
}

def _match(tag, vocab):
    spaced = tag.lower().strip()
    despaced = re.sub(r"[\s_/&-]", "", spaced)
    for sub, canon in vocab.items():
        s = re.sub(r"[\s_/&-]", "", sub)
        if s in despaced:
            return canon
    return None

def normalize_product(p):
    ptype = (p.get("product_type") or "").lower().strip()
    cat = CATEGORY.get(ptype)
    attrs = {dim: [] for dim in DIMS}
    for tag in p.get("tags", []):
        for dim, vocab in DIMS.items():
            m = _match(tag, vocab)
            if m and m not in attrs[dim]:
                attrs[dim].append(m)
    variants = p.get("variants", [])
    available = any(v.get("available") for v in variants)
    sizes = [v.get("title") for v in variants if v.get("available")]
    img = (p.get("images") or [{}])[0].get("src")
    try:
        price = int(float(variants[0].get("price"))) if variants else None
    except (TypeError, ValueError):
        price = None
    return {
        "id": p.get("id"),
        "handle": p.get("handle"),
        "title": p.get("title"),
        "category": cat,
        "price": price,
        "available": available,
        "sizes": sizes,
        "image": img,
        "attrs": {k: v for k, v in attrs.items()},
    }

if __name__ == "__main__":
    BRANDS = {"snitch": "snitch.com", "bearhouse": "thebearhouse.com"}
    grand = {}
    for brand in BRANDS:
        prods = json.load(open(f"data/raw_{brand}.json", encoding="utf-8"))
        norm = [normalize_product(p) for p in prods]
        json.dump(norm, open(f"data/norm_{brand}.json", "w", encoding="utf-8"), ensure_ascii=False)
        n = len(norm)
        print(f"\n{'='*60}\n{brand.upper()}  ({n} products)")
        # coverage per dimension
        cat_cov = sum(1 for x in norm if x["category"]) / n
        print(f"  category   {cat_cov*100:5.1f}%")
        for dim in DIMS:
            cov = sum(1 for x in norm if x["attrs"][dim]) / n
            dist = Counter(v for x in norm for v in x["attrs"][dim])
            top = ", ".join(f"{k}:{c}" for k, c in dist.most_common(6))
            print(f"  {dim:9s}  {cov*100:5.1f}%   [{top}]")
        grand[brand] = norm
    print("\nsaved -> data/norm_snitch.json, data/norm_bearhouse.json")
