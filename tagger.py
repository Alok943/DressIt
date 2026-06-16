"""
Dressit VLM tagger.
image + title  ->  same schema as normalize.py, using the SAME canonical vocab.

Default backend: Gemini Flash via REST (no SDK needed). Set GEMINI_API_KEY.
(Free tier at https://aistudio.google.com/apikey is plenty for validation.)

Usage:
  GEMINI_API_KEY=...  python tagger.py            # smoke test on 3 products
"""
import os, json, base64, urllib.request, ssl, re

# minimal .env loader (zero deps): KEY=VALUE lines, # comments, optional quotes
def _load_env(path=os.path.join(os.path.dirname(__file__), ".env")):
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_env()

CTX = ssl._create_unverified_context()
UA = {"User-Agent": "Mozilla/5.0"}
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
KEY = os.environ.get("GEMINI_API_KEY", "")

# allowed canonical values per dimension — MUST match normalize.py
ALLOWED = {
    "gender": ["men","women","unisex"],
    "category": ["shirt","tshirt","polo","trousers","jeans","cargo","shorts","jacket",
                 "sweater","sweatshirt","hoodie","joggers","shoes","accessory","dress","skirt","top","coord"],
    "fit": ["oversized","regular","relaxed","slim","baggy","straight","skinny","muscle","tapered"],
    "occasion": ["casual","smart_casual","formal","party","street","active","lounge","work",
                 "festive","travel","winter","vacation"],
    "color": ["black","white","navy","blue","olive","green","red","pink","beige","brown","grey",
              "maroon","yellow","orange","purple","lavender","cream","khaki","burgundy","teal",
              "mustard","peach","multi"],
    "sleeve": ["half","full","sleeveless"],
    "pattern": ["solid","check","stripe","print","floral","graphic","embroidery","textured",
                "washed","colorblock","camo"],
    "fabric": ["cotton","linen","denim","polyester","nylon","rayon","viscose","wool","leather",
               "corduroy","satin","silk","terry","fleece","knit","twill","oxford"],
}

FIT_GUIDE = (
    "\nFIT — pick the single best one, using these definitions:\n"
    "  slim = tapered, sits close to the body, fitted through chest/legs\n"
    "  regular = standard/true-to-size, straight cut, not tight or baggy (the default)\n"
    "  relaxed = roomy and comfortable but still proportional to the body\n"
    "  oversized = intentionally large, dropped shoulders, deliberately baggy/boxy "
    "(titles often say 'oversized' or 'box fit')\n"
    "  baggy = very loose, wide all over (mainly bottoms)\n"
    "  straight = straight leg, no taper (bottoms)\n"
    "  Trust the title's fit word if present. Prefer ONE fit value.\n"
)

PROMPT = (
    "You are a fashion catalog tagger. Look at the product image and title and output ONLY a JSON "
    "object tagging the garment. Use ONLY these allowed values per field. Always give your best "
    "single guess for pattern and fabric even if unsure (do not return empty for those). "
    "For sleeve use [] on bottoms/shoes/accessories.\n"
    + "\n".join(f"  {d}: {vals}" for d, vals in ALLOWED.items())
    + FIT_GUIDE
    + "\nGENDER — men, women, or unisex, based on cut/styling in the image and title.\n"
    + "\nReturn exactly: {\"gender\":[..],\"category\":[..],\"fit\":[..],\"occasion\":[..],"
      "\"color\":[..],\"sleeve\":[..],\"pattern\":[..],\"fabric\":[..]}. gender = exactly one value; "
      "category = exactly one value; fit = exactly one value; color = the ONE dominant color "
      "(add a second only if the garment is genuinely two-tone); occasion = at most two. "
      "No prose, no markdown, JSON only."
)

def _fetch_image_b64(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
        return base64.b64encode(r.read()).decode(), r.headers.get("Content-Type", "image/jpeg")

# Optional per-store nudge. Bake-off (Claude vs Gemini on Bonkers) showed Gemini
# under-calls oversized on streetwear catalogs — it defaults ambiguous cuts to
# 'regular'. Pass this for streetwear labels so roomy/ambiguous pieces lean oversized.
STREETWEAR_HINT = (
    "\nSTORE STYLE: this is a streetwear label whose tees, sweatshirts and hoodies are "
    "predominantly cut OVERSIZED (dropped shoulders, boxy). If the garment looks roomy or "
    "boxy, or the fit is ambiguous and the title has no explicit fit word, prefer "
    "'oversized' (or 'relaxed') over 'regular'.\n"
)

def tag_product(title, image_url, style_hint=""):
    if not KEY:
        raise RuntimeError("Set GEMINI_API_KEY")
    b64, mime = _fetch_image_b64(image_url)
    mime = "image/jpeg" if "jpeg" in mime or "jpg" in mime else ("image/png" if "png" in mime else "image/webp")
    body = {
        "contents": [{"parts": [
            {"text": PROMPT + style_hint + f"\n\nTitle: {title}"},
            {"inline_data": {"mime_type": mime, "data": b64}},
        ]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
        resp = json.load(r)
    txt = resp["candidates"][0]["content"]["parts"][0]["text"]
    out = json.loads(txt)
    # clamp to allowed vocab
    clean = {}
    for d, vals in ALLOWED.items():
        got = out.get(d, [])
        if isinstance(got, str):
            got = [got]
        clean[d] = [v for v in got if v in vals]
    return clean

if __name__ == "__main__":
    norm = json.load(open("data/norm_snitch.json", encoding="utf-8"))
    for p in norm[:3]:
        pred = tag_product(p["title"], p["image"])
        print(f"\n{p['title']}")
        print(f"  truth: {p['attrs']}")
        print(f"  pred : {pred}")
