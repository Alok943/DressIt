"""
List Gemini models your key can use (for generateContent).
Settles which flash model IDs actually resolve.

Usage:  python check_models.py     (reads GEMINI_API_KEY from .env)
"""
import os, json, ssl, urllib.request
from tagger import KEY  # reuses .env loader

CTX = ssl._create_unverified_context()

def main():
    if not KEY:
        print("No GEMINI_API_KEY — paste it into .env first."); return
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={KEY}&pageSize=200"
    with urllib.request.urlopen(urllib.request.Request(url), timeout=30, context=CTX) as r:
        models = json.load(r).get("models", [])
    gen = [m for m in models if "generateContent" in m.get("supportedGenerationMethods", [])]
    print(f"{len(gen)} models support generateContent. Flash / vision-capable:\n")
    for m in sorted(gen, key=lambda x: x["name"]):
        name = m["name"].replace("models/", "")
        if "flash" in name or "pro" in name:
            print(f"  {name:32s}  {m.get('displayName','')}")
    print("\nSet GEMINI_MODEL in .env to one of the IDs above (left column).")

if __name__ == "__main__":
    main()
