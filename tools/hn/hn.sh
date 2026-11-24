#!/usr/bin/env bash
# Janus nightly Hacker News audio digest.
#
# 1. Make sure Helium is up with CDP on :9333 (reopen it if not).
# 2. Fetch the front page (top 60) and comment trees from the HN API.
# 3. A triage agent sorts the stories by the interests file.
# 4. Helium reads the linked articles one at a time (curl when Helium is down).
# 5. Up to 6 writer agents, ~10 stories each, write two-host debate scripts.
# 6. Kokoro-82M renders one mp3; when enabled, tools/hn/upload.py uploads it
#    privately to YouTube Music; the must-reads go to
#    `## Must-read (HN)` in that day's journal (plus a problem line only on failure).
#
# Interests: tools/hn/interests.md (yours: listener name, profile, tiers);
# without it, tools/hn/interests.example.md is used. Copy the example to start.
#
#   hn.sh              run when due (launchd runs this daily at 04:30)
#   hn.sh --force      run now even if today already ran
#   --no-upload        skip the upload for this run (e.g. a test run)
#   JANUS_HN_DATE=YYYY-MM-DD overrides the run date.
#   .janus/hn/disabled pauses scheduled runs; --force still runs.
#   .janus/hn/upload   enables the YouTube Music upload (off without it).
# Output: .janus/hn/<date>/ (episode.mp3, report.md, intermediate files).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HN="$ROOT/tools/hn"
STATE="$ROOT/.janus/hn"
LOG="$STATE/hn.log"
LOCK="$STATE/lock"
LAST="$STATE/last"
SEEN="$STATE/seen.tsv"
START_HOUR=4
STORIES="${JANUS_HN_STORIES:-60}"
WRITERS="${JANUS_HN_WRITERS:-6}"
MODEL="${JANUS_HN_MODEL:-anthropic/claude-opus-5-5}"
WRITE_TIMEOUT="${JANUS_HN_WRITE_TIMEOUT:-1500}"
HELIUM_CDP=http://127.0.0.1:9333
INTERESTS="$HN/interests.md"
[[ -f "$INTERESTS" ]] || INTERESTS="$HN/interests.example.md"
FORCE=0
UPLOAD=0
[[ -e "$STATE/upload" ]] && UPLOAD=1
while (( $# )); do
  case "$1" in
    --force) FORCE=1; shift ;;
    --no-upload) UPLOAD=0; shift ;;
    *) echo "usage: hn.sh [--force] [--no-upload]" >&2; exit 2 ;;
  esac
done

mkdir -p "$STATE"
cd "$ROOT"
TODAY=${JANUS_HN_DATE:-$(date +%F)}
RUN="$STATE/$TODAY"
JOURNAL="$ROOT/journal/$TODAY.md"
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG" >&2; }

if (( ! FORCE )); then
  [[ ! -e "$STATE/disabled" ]] || exit 0
  (( 10#$(date +%H) >= START_HOUR )) || exit 0
  [[ "$(cat "$LAST" 2>/dev/null || true)" != "$TODAY" ]] || exit 0
fi
if ! mkdir "$LOCK" 2>/dev/null; then
  kill -0 "$(cat "$LOCK/pid" 2>/dev/null || echo 0)" 2>/dev/null && { log "already running"; exit 0; }
  rm -rf "$LOCK"; mkdir "$LOCK"
fi
echo $$ >"$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
mkdir -p "$RUN/scripts" "$RUN/logs"

STEP=start
fail() {
  log "failed at $STEP: $1"
  python3 "$HN/assemble.py" journal "$RUN" "$TODAY" "$JOURNAL" "failed at $STEP ($1); see .janus/hn/$TODAY/report.md and .janus/hn/hn.log." || true
  printf -- '- Status: failed at %s: %s\n' "$STEP" "$1" >>"$RUN/report.md"
  exit 1
}

render() {
  local prompt pair
  prompt=$(<"$1"); shift
  prompt=${prompt//'{{date}}'/"$TODAY"}
  prompt=${prompt//'{{root}}'/"$ROOT"}
  prompt=${prompt//'{{run}}'/"$RUN"}
  prompt=${prompt//'{{interests}}'/"$INTERESTS"}
  for pair in "$@"; do prompt=${prompt//"{{${pair%%=*}}}"/"${pair#*=}"}; done
  printf '%s' "$prompt"
}

# agent NAME TIMEOUT PROMPT : one unattended omp agent; output in $RUN/logs/NAME.log.
agent() {
  local name=$1 limit=$2 prompt=$3 pid watchdog code=0
  JANUS_DREAM=1 BU_NAME=helium BU_CDP_URL="$HELIUM_CDP" omp -p --no-session --no-title \
    --model "$MODEL" --auto-approve --max-time "$limit" "$prompt" >"$RUN/logs/$name.log" 2>&1 &
  pid=$!
  ( sleep $(( limit + 120 )); kill "$pid" 2>/dev/null && log "$name killed after $(( limit + 120 ))s" ) &
  watchdog=$!
  wait "$pid" || code=$?
  kill "$watchdog" 2>/dev/null || true
  return "$code"
}

helium_up() { curl -fsS --max-time 2 -o /dev/null "$HELIUM_CDP/json/version"; }
helium_smoke() { BU_NAME=helium BU_CDP_URL="$HELIUM_CDP" browser-use <<<'print(page_info())' >/dev/null 2>&1; }

# Same recovery as tools/jobs/jobs.sh, but soft: returns 1 instead of failing the run.
ensure_helium() {
  local i
  if ! helium_up; then
    if pgrep -x Helium >/dev/null; then
      log "Helium running without CDP; quitting to reopen with :9333"
      osascript -e 'tell application "Helium" to quit' || return 1
      for (( i=0; i<60; i++ )); do pgrep -x Helium >/dev/null || break; sleep 0.5; done
      pgrep -x Helium >/dev/null && return 1
    fi
    open -n -a Helium --args --remote-debugging-port=9333 || return 1
    for (( i=0; i<30; i++ )); do helium_up && break; sleep 1; done
    helium_up || return 1
    BU_NAME=helium browser-use --reload >/dev/null 2>&1 || return 1
    log "Helium CDP ready on :9333"
  fi
  helium_smoke && return 0
  BU_NAME=helium browser-use --reload >/dev/null 2>&1 || return 1
  helium_smoke
}

log "run $TODAY started"
: >"$RUN/report.md"

STEP=helium
BROWSER=helium
if ! ensure_helium; then
  BROWSER=curl
  log "Helium unavailable; articles via curl, no upload"
  echo "- Problem: Helium unavailable; articles read with curl, upload skipped." >>"$RUN/report.md"
fi

STEP=fetch
python3 "$HN/fetch.py" "$RUN" "$SEEN" "$STORIES" >>"$LOG" 2>&1 || fail "HN API fetch failed"

STEP=triage
agent triage 900 "$(render "$HN/triage.md")" || true
python3 - "$RUN" <<'PY' || fail "triage.json missing or invalid"
import json, sys
from pathlib import Path
run = Path(sys.argv[1])
idx = {s["id"] for s in json.loads((run / "index.json").read_text())}
tri = json.loads((run / "triage.json").read_text())
assert {t["id"] for t in tri} == idx and all(t["tier"] in ("deep", "light", "brief", "skip") for t in tri)
PY

STEP=articles
python3 "$HN/read_articles.py" "$RUN" "$BROWSER" >>"$LOG" 2>&1 || fail "article reading crashed"

STEP=write
rm -rf "$RUN/groups" "$RUN/scripts"; mkdir -p "$RUN/scripts"
n=$(python3 "$HN/assemble.py" groups "$RUN" "$WRITERS")
(( n > 0 )) || fail "triage kept no stories"
pids=()
for (( g=1; g<=n; g++ )); do
  agent "write-$g" "$WRITE_TIMEOUT" "$(render "$HN/write.md" "group=$g" "stories=$RUN/groups/$g.tsv" "out=$RUN/scripts/$g.json")" &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done
ls "$RUN"/scripts/*.json >/dev/null 2>&1 || fail "no writer produced a script"

STEP=audio
python3 "$HN/assemble.py" episode "$RUN" "$TODAY" "$INTERESTS" >>"$LOG" 2>&1 || fail "episode assembly failed"
TITLE="HN digest $TODAY"
uv run --quiet "$HN/tts.py" "$RUN/episode.json" "$RUN" --title "$TITLE" >>"$LOG" 2>&1 || fail "Kokoro rendering failed"
MINUTES=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RUN/episode.mp3" | awk '{printf "%d", $1/60 + 0.5}')

STEP=upload
STATUS="\"$TITLE\" ($MINUTES min) in .janus/hn/$TODAY/episode.mp3; not uploaded"
if (( UPLOAD )) && [[ $BROWSER == helium ]]; then
  ensure_helium || true
  python3 "$HN/upload.py" "$RUN/episode.mp3" "$TITLE" "$RUN/upload.status" >>"$LOG" 2>&1 || true
  up=$(head -1 "$RUN/upload.status" 2>/dev/null || echo "failed: upload script wrote no status")
  STATUS="\"$TITLE\" ($MINUTES min), YouTube Music $up"
  [[ $up == uploaded* || $up == already* || $up == processing* ]] || echo "- Problem: upload $up" >>"$RUN/report.md"
fi

STEP=journal
python3 "$HN/assemble.py" journal "$RUN" "$TODAY" "$JOURNAL" "$STATUS" >>"$LOG" 2>&1 || fail "journal write failed"
python3 "$HN/assemble.py" seen "$RUN" "$TODAY" "$SEEN"
echo "$TODAY" >"$LAST"

python3 - "$RUN" "$STATUS" >>"$RUN/report.md" <<'PY'
import json, sys
from pathlib import Path
run, status = Path(sys.argv[1]), sys.argv[2]
tri = json.loads((run / "triage.json").read_text())
arts = json.loads((run / "articles.json").read_text())
dropped = json.loads((run / "dropped.json").read_text())
print(f"- Status: ok\n- Episode: {status}")
for tier in ("deep", "light", "brief"):
    print(f"- {tier}: {sum(t['tier'] == tier for t in tri)}")
print("- Articles:")
for k, v in arts.items():
    print(f"  - {k}: {v}")
print("- Skipped:")
for t in tri:
    if t["tier"] == "skip":
        print(f"  - {t['title']}: {t['reason']}")
for d in dropped:
    print(f"  - {d['title']}: {d['reason']}")
PY
log "run $TODAY done: $STATUS"
