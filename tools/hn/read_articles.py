"""Read linked articles one at a time and save their text.

usage: python3 tools/hn/read_articles.py RUN_DIR helium|curl

Reads RUN_DIR/triage.json, and for every story not tiered `skip` with an
external URL writes RUN_DIR/articles/<id>.txt. `helium` drives the local Helium
through the browser-use CLI (BU_NAME=helium, one tab, closed at the end) so
Cloudflare-protected pages load; `curl` is the fallback when Helium is down.
A story whose article could not be read gets no file (writers treat it as
comments-only). Writes RUN_DIR/articles.json with per-story status.
"""
import html
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

MAX_CHARS = 20000
SKIP_EXT = (".pdf", ".mp4", ".mp3", ".zip")

# Runs inside browser-use; reads the job from JANUS_HN_JOB.
BROWSER_SCRIPT = r'''
import json, os, time
job = json.load(open(os.environ["JANUS_HN_JOB"]))
results = {}
tab = new_tab("about:blank")
EXTRACT = """(() => {
  const pick = document.querySelector('article') || document.querySelector('main') || document.body;
  return JSON.stringify({title: document.title, text: (pick && pick.innerText) || ''});
})()"""
for sid, url in job["items"]:
    try:
        goto_url(url)
        wait_for_load(timeout=20)
        time.sleep(2.5)  # human pace; lets bot checks and late content settle
        data = json.loads(js(EXTRACT) or "{}")
        text = data.get("text", "")
        if len(text) < 400:  # interstitial (e.g. Cloudflare check): give it one more wait
            time.sleep(6)
            data = json.loads(js(EXTRACT) or "{}")
            text = data.get("text", "")
        open(os.path.join(job["out"], f"{sid}.txt"), "w").write(text[:job["max"]])
        results[sid] = f"helium:{len(text)}"
    except Exception as e:
        results[sid] = f"error:{type(e).__name__}: {e}"[:200]
try:
    close_tab(tab)
except Exception:
    pass
json.dump(results, open(job["status"], "w"))
'''


def curl_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh) janus-hn-digest"})
    with urllib.request.urlopen(req, timeout=25) as r:
        raw = r.read(3_000_000).decode("utf-8", "replace")
    raw = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header).*?</\1>", " ", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return re.sub(r"\s+\n|\n\s+|[ \t]{2,}", "\n", text).strip()


def main() -> None:
    run, mode = Path(sys.argv[1]), sys.argv[2]
    triage = json.loads((run / "triage.json").read_text())
    stories = {s["id"]: s for s in (json.loads(p.read_text()) for p in (run / "stories").glob("*.json"))}
    out = run / "articles"
    out.mkdir(exist_ok=True)
    items, status = [], {}
    for t in triage:
        s = stories.get(t["id"])
        if not s or t["tier"] == "skip":
            continue
        url = s["url"]
        if not url or "news.ycombinator.com" in url:
            status[s["id"]] = "self-post"
        elif url.lower().split("?")[0].endswith(SKIP_EXT):
            status[s["id"]] = "unsupported file type"
        else:
            items.append((s["id"], url))

    if mode == "helium" and items:
        job = run / "article-job.json"
        job.write_text(json.dumps({"items": items, "out": str(out), "max": MAX_CHARS, "status": str(run / "article-helium.json")}))
        env = os.environ | {"BU_NAME": "helium", "BU_CDP_URL": "http://127.0.0.1:9333", "JANUS_HN_JOB": str(job)}
        try:
            subprocess.run(["browser-use"], input=BROWSER_SCRIPT, text=True, env=env, timeout=60 * len(items) + 120,
                           capture_output=True)
        except subprocess.TimeoutExpired:
            pass
        hp = run / "article-helium.json"
        status |= {int(k): v for k, v in json.loads(hp.read_text()).items()} if hp.exists() else {}

    for sid, url in items:  # curl mode, or Helium misses
        if str(status.get(sid, "")).startswith("helium:") and (out / f"{sid}.txt").stat().st_size >= 400:
            continue
        try:
            text = curl_text(url)
            if len(text) >= 400:
                (out / f"{sid}.txt").write_text(text[:MAX_CHARS])
                status[sid] = f"curl:{len(text)}"
            else:
                status.setdefault(sid, "unreadable")
        except Exception as e:
            status[sid] = f"{status.get(sid, '')} curl error: {e}"[:200]

    for sid, _ in items:
        f = out / f"{sid}.txt"
        if f.exists() and f.stat().st_size < 400:
            f.unlink()
            status[sid] = f"too short ({status.get(sid)}); comments-only"
    (run / "articles.json").write_text(json.dumps(status, indent=1))
    ok = sum(1 for sid, _ in items if (out / f"{sid}.txt").exists())
    print(f"articles: {ok}/{len(items)} read ({mode})")


if __name__ == "__main__":
    main()
