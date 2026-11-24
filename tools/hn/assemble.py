"""Plan writer groups, assemble the episode, and write the journal section.

usage:
  python3 tools/hn/assemble.py groups RUN_DIR N        -> RUN_DIR/groups/<n>.tsv, prints group count
  python3 tools/hn/assemble.py episode RUN_DIR DATE [INTERESTS_MD] -> RUN_DIR/episode.json
  python3 tools/hn/assemble.py journal RUN_DIR DATE JOURNAL_MD STATUS_LINE
  python3 tools/hn/assemble.py seen RUN_DIR DATE SEEN_TSV
Stdlib only.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

ORDER = {"deep": 0, "light": 1, "brief": 2}
SECTION = "## Must-read (HN)"


def load(p: Path):
    return json.loads(p.read_text())


def listener_name(interests: Path | None) -> str:
    """The `Name:` line of the interests file's `## Listener` section, or ''."""
    if not interests or not interests.exists():
        return ""
    match = re.search(r"^## Listener\s*$(.*?)(?=^## |\Z)", interests.read_text(), re.M | re.S)
    name = re.search(r"^Name:[ \t]*(\S.*?)[ \t]*$", match.group(1), re.M) if match else None
    return name.group(1) if name else ""


def kept(run: Path):
    return [t for t in load(run / "triage.json") if t["tier"] in ORDER]


def groups(run: Path, n: int) -> None:
    items = kept(run)
    # Balance by workload: a deep story costs more than a brief one.
    weight = {"deep": 3, "light": 1, "brief": 0.3}
    bins = [[] for _ in range(n)]
    load_ = [0.0] * n
    for t in sorted(items, key=lambda t: -weight[t["tier"]]):
        i = min(range(n), key=lambda i: (load_[i], len(bins[i])))
        bins[i].append(t)
        load_[i] += weight[t["tier"]]
    out = run / "groups"
    out.mkdir(exist_ok=True)
    count = 0
    for b in bins:
        if not b:
            continue
        count += 1
        (out / f"{count}.tsv").write_text("".join(f"{t['id']}\t{t['tier']}\n" for t in sorted(b, key=lambda t: t.get("rank", 0))))
    print(count)


def scripts(run: Path):
    by_id = {}
    for p in sorted((run / "scripts").glob("*.json")):
        try:
            for s in load(p)["stories"]:
                if s.get("lines"):
                    by_id[int(s["id"])] = s
        except Exception as e:  # one bad writer must not sink the episode
            print(f"skipping {p.name}: {e}", file=sys.stderr)
    return by_id


def episode(run: Path, date: str, interests: Path | None = None) -> None:
    triage = kept(run)
    rank = {t["id"]: i for i, t in enumerate(triage)}
    tier = {t["id"]: t["tier"] for t in triage}
    by_id = scripts(run)
    ordered = sorted(by_id.values(), key=lambda s: (ORDER.get(tier.get(int(s["id"]), "brief"), 2), rank.get(int(s["id"]), 999)))
    full = [s for s in ordered if tier.get(int(s["id"])) != "brief"]
    briefs = [s for s in ordered if tier.get(int(s["id"])) == "brief"]
    stories = [{"id": s["id"], "title": s["title"], "lines": s["lines"]} for s in full]
    if briefs:
        lines = [{"speaker": "A", "text": "Quick hits before we go."}]
        for i, s in enumerate(briefs):
            lines.append({"speaker": "AB"[i % 2], "text": s["lines"][0]["text"]})
        stories.append({"id": "quick-hits", "title": "Quick hits", "lines": lines})
    day = dt.date.fromisoformat(date).strftime("%A, %B %-d")
    deep = sum(1 for s in full if tier.get(int(s["id"])) == "deep")
    light = len(full) - deep
    must = sum(1 for s in by_id.values() if s.get("must_read"))
    intro = [
        {"speaker": "A", "text": f"Good morning{', ' + name if (name := listener_name(interests)) else ''}. This is your Hacker News digest for {day}. I'm Ava."},
        {"speaker": "B", "text": f"And I'm Sam. We went through the front page: {deep} stories in depth, {light} quick news items, and a round of quick hits."},
    ]
    outro = [{"speaker": "A", "text": "That's the digest."},
             {"speaker": "B", "text": f"{must} must-read{'s' if must != 1 else ''} {'are' if must != 1 else 'is'} waiting in today's journal. Go build something."}]
    (run / "episode.json").write_text(json.dumps({"intro": intro, "stories": stories, "outro": outro}, indent=1))
    print(f"episode: {len(stories)} chapters, {must} must-read")


def stamp(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def journal(run: Path, date: str, path: Path, status: str) -> None:
    stories = {s["id"]: s for s in (load(p) for p in (run / "stories").glob("*.json"))}
    by_id = scripts(run) if (run / "scripts").exists() else {}
    lines = [SECTION, ""]
    must = [s for s in by_id.values() if s.get("must_read")]
    for s in must:
        src = stories.get(int(s["id"]), {})
        link = src.get("url") or src.get("hn_url", "")
        lines.append(f"- [{src.get('title', s['title'])}]({link}): {s.get('must_read_reason', '').strip()} ([HN]({src.get('hn_url', '')}))")
    if not must:
        lines.append("- None today.")
    # Only the must-reads go here; the episode line appears only when something went wrong.
    if not any(ok in status for ok in ("YouTube Music uploaded", "YouTube Music already", "YouTube Music processing")):
        lines += ["", f"Episode problem: {status}"]
    lines.append("")
    block = "\n".join(lines)

    text = path.read_text() if path.exists() else f"# {date}\n"
    start = text.find(SECTION)
    if start >= 0:
        nxt = text.find("\n## ", start + len(SECTION))
        text = text[:start] + block + (text[nxt + 1:] if nxt >= 0 else "")
    else:
        text = text.rstrip("\n") + "\n\n" + block
    path.write_text(text.rstrip("\n") + "\n")
    print(f"journal: {path}")


def seen(run: Path, date: str, path: Path) -> None:
    if not path.exists():
        path.write_text("date\tid\ttitle\n")
    with path.open("a") as f:
        for t in load(run / "triage.json"):
            f.write(f"{date}\t{t['id']}\t{t['title'].replace(chr(9), ' ')}\n")


if __name__ == "__main__":
    cmd, run = sys.argv[1], Path(sys.argv[2])
    if cmd == "groups":
        groups(run, int(sys.argv[3]))
    elif cmd == "episode":
        episode(run, sys.argv[3], Path(sys.argv[4]) if len(sys.argv) > 4 else None)
    elif cmd == "journal":
        journal(run, sys.argv[3], Path(sys.argv[4]), sys.argv[5])
    elif cmd == "seen":
        seen(run, sys.argv[3], Path(sys.argv[4]))
    else:
        sys.exit(__doc__)
