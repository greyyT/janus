"""Fetch the HN front page (top N stories) with comment trees.

usage: python3 tools/hn/fetch.py RUN_DIR SEEN_TSV [N]

Writes RUN_DIR/stories/<id>.json (story + flattened comments) and
RUN_DIR/index.json (rank-ordered summary for triage). Stories already listed
in SEEN_TSV (covered on an earlier day) and job ads are left out of the index.
Stdlib only.
"""
import html
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

FIREBASE = "https://hacker-news.firebaseio.com/v0"
ALGOLIA = "https://hn.algolia.com/api/v1/items"
COMMENT_BUDGET = 14000  # characters of comments kept per story


def get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "janus-hn-digest"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def clean(text: str | None) -> str:
    text = re.sub(r"<p>", "\n", text or "")
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def flatten(node, depth=0, out=None):
    """Depth-first, keeping thread structure as indentation; top threads first."""
    out = [] if out is None else out
    for child in node.get("children") or []:
        if child.get("type") != "comment" or not child.get("text"):
            continue
        out.append({"depth": depth, "author": child.get("author"), "text": clean(child["text"])})
        flatten(child, depth + 1, out)
    return out


def budget(comments):
    kept, used = [], 0
    for c in comments:
        if c["depth"] > 3:
            continue
        cost = len(c["text"]) + 20
        if used + cost > COMMENT_BUDGET:
            break
        kept.append(c)
        used += cost
    return kept


def story(rank_id):
    rank, sid = rank_id
    item = get(f"{ALGOLIA}/{sid}")
    comments = flatten(item)
    return {
        "id": sid,
        "rank": rank,
        "title": item.get("title") or "",
        "url": item.get("url") or "",
        "hn_url": f"https://news.ycombinator.com/item?id={sid}",
        "points": item.get("points"),
        "type": item.get("type"),
        "text": clean(item.get("text")),
        "comment_count": len(comments),
        "comments": budget(comments),
    }


def main() -> None:
    run, seen_path = Path(sys.argv[1]), Path(sys.argv[2])
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    seen = set()
    if seen_path.exists():
        for line in seen_path.read_text().splitlines()[1:]:
            if line.strip():
                seen.add(int(line.split("\t")[1]))
    ids = get(f"{FIREBASE}/topstories.json")[:n]
    (run / "stories").mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(8) as pool:
        stories = list(pool.map(story, enumerate(ids, 1)))
    index, dropped = [], []
    for s in stories:
        (run / "stories" / f"{s['id']}.json").write_text(json.dumps(s, indent=1))
        if s["id"] in seen:
            dropped.append({"id": s["id"], "title": s["title"], "reason": "covered on an earlier day"})
        elif s["type"] == "job":
            dropped.append({"id": s["id"], "title": s["title"], "reason": "job ad"})
        else:
            top = next((c["text"][:300] for c in s["comments"] if c["depth"] == 0), "")
            index.append({k: s[k] for k in ("id", "rank", "title", "url", "points", "comment_count")} | {"top_comment": top})
    (run / "index.json").write_text(json.dumps(index, indent=1))
    (run / "dropped.json").write_text(json.dumps(dropped, indent=1))
    print(f"fetched {len(stories)}; {len(index)} for triage; {len(dropped)} dropped")


if __name__ == "__main__":
    main()
