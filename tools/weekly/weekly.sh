#!/usr/bin/env bash
# Janus weekly review. Reviews the last finished ISO week on a worktree of
# origin/main and opens a weekly/* PR. Unlike Dream, it moves nothing out of
# the main checkout.
#
#   weekly.sh              review now when due (launchd runs this Monday 04:00)
#   weekly.sh catch-up     report an unseen failure, or when due, review in the background
#   weekly.sh --dry-run    review the last finished week on a throwaway worktree;
#                          write the PR body and diff under .janus/weekly/dry-run/
#   --prompt PATH          another prompt file instead of tools/weekly/prompt.md
#
# A week is due once it is past Monday 04:00 (after the 03:00 dream of
# Sunday) and .janus/weekly/last is older. Only the latest week is reviewed;
# missed older weeks are skipped. Authority: "Weekly review commits and opens
# its PR" in brain/Grants.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/.janus/weekly"
LAST="$STATE/last"
LOCK="$STATE/lock"
FAILED="$STATE/failed"
LOG="$STATE/weekly.log"
MODE=""
PROMPT="$ROOT/tools/weekly/prompt.md"
while (( $# )); do
  case "$1" in
    --prompt) PROMPT="${2:?--prompt needs a path}"; shift 2 ;;
    --dry-run) MODE=dry-run; shift ;;
    catch-up) MODE=catch-up; shift ;;
    *) echo "usage: weekly.sh [catch-up | [--dry-run] [--prompt PATH]]" >&2; exit 2 ;;
  esac
done
[[ "$PROMPT" == /* ]] || PROMPT="$ROOT/$PROMPT"
[[ -f "$PROMPT" ]] || { echo "no prompt file at $PROMPT" >&2; exit 2; }
mkdir -p "$STATE"
cd "$ROOT"
exec 3>&1 4>&2 >>"$LOG" 2>&1

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

# The last finished week: the Sunday before (now - 4h), and its ISO week.
SUNDAY=$(date -v-4H -v-"$(date -v-4H +%u)"d +%F)
WEEK=$(date -j -f %F "$SUNDAY" +%G-W%V)

fail() {
  log "$1"
  if [[ "$MODE" == dry-run ]]; then echo "$1 See $LOG." >&4; else echo "$1 See $LOG." >"$FAILED"; fi
  exit 1
}

due() {
  local last
  last=$(cat "$LAST" 2>/dev/null || true)
  [[ -z "$last" || "$last" < "$WEEK" ]]
}

acquire_lock() {
  if ! mkdir "$LOCK" 2>/dev/null; then
    local holder
    holder=$(cat "$LOCK/pid" 2>/dev/null || true)
    if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then exit 0; fi
    rm -rf "$LOCK" && mkdir "$LOCK"
  fi
  echo $$ >"$LOCK/pid"
}

cleanup() {
  [[ -n "${worktree:-}" && -d "$worktree" ]] && git worktree remove --force "$worktree"
  [[ -n "${branch:-}" ]] && git branch -D -q "$branch" 2>/dev/null
  rm -rf "$LOCK"
}

render_prompt() { # template body diff_target input branch
  local prompt
  prompt=$(<"$1")
  prompt=${prompt//'{{week}}'/"$WEEK"}
  prompt=${prompt//'{{sunday}}'/"$SUNDAY"}
  prompt=${prompt//'{{root}}'/"$ROOT"}
  prompt=${prompt//'{{pr_body}}'/"$2"}
  prompt=${prompt//'{{input}}'/"$3"}
  printf '%s' "${prompt//'{{branch}}'/"$4"}"
}

review() { # worktree out_dir branch
  pnpm -s weekly:input -- --week "$WEEK" --sunday "$SUNDAY" --dir "$1" >"$2/input.md" || return 10
  (cd "$1" && JANUS_DREAM=1 pi -p --no-session "$(render_prompt "$PROMPT" "$2/pr-body.md" "$2/input.md" "$3")") || return 11
  [[ -s "$2/pr-body.md" ]] || return 12
}

run() {
  due || exit 0
  acquire_lock
  trap cleanup EXIT
  # Dream and the review both fetch and add worktrees; let Dream finish first.
  if [[ -d "$ROOT/.janus/dream/lock" ]] && kill -0 "$(cat "$ROOT/.janus/dream/lock/pid" 2>/dev/null || echo 0)" 2>/dev/null; then
    log "dream running; weekly review of $WEEK postponed"
    exit 0
  fi
  if ! curl -fsS --max-time 5 -o /dev/null https://api.github.com; then
    log "offline; weekly review of $WEEK postponed"
    exit 0
  fi
  git fetch -q origin || fail "Weekly review of $WEEK postponed: cannot fetch origin."
  branch="weekly/$WEEK"
  if git rev-parse -q --verify "origin/$branch" >/dev/null; then branch+="-$(date +%H%M%S)"; fi
  worktree="${TMPDIR:-/tmp}/janus-weekly-$WEEK"
  git worktree prune
  git worktree add -q -B "$branch" "$worktree" origin/main || fail "Weekly review of $WEEK failed: cannot create the worktree."

  local out="$STATE/run" code=0
  rm -rf "$out" && mkdir -p "$out"
  review "$worktree" "$out" "$branch" || code=$?
  case "$code" in
    0) ;;
    10) fail "Weekly review of $WEEK failed: cannot gather the inputs." ;;
    11) fail "Weekly review of $WEEK failed: pi exited with an error." ;;
    *) fail "Weekly review of $WEEK failed: no PR body written." ;;
  esac
  printf '\n_Prompt: `%s`_\n' "${PROMPT#"$ROOT/"}" >>"$out/pr-body.md"

  git -C "$worktree" add -A
  git -C "$worktree" commit -q --allow-empty -m "weekly: $WEEK" || fail "Weekly review of $WEEK failed: cannot commit."
  git -C "$worktree" push -q -u origin "$branch" || fail "Weekly review of $WEEK failed: push failed."
  # Pushed: the week counts as reviewed from here on.
  echo "$WEEK" >"$LAST"
  gh pr create --base main --head "$branch" --title "weekly: $WEEK" --body-file "$out/pr-body.md" >"$STATE/pr" \
    || fail "Weekly review pushed $branch but could not open the PR: run gh pr create --head $branch --body-file $out/pr-body.md."
  log "reviewed $WEEK on $branch"
}

dry_run() {
  acquire_lock
  local out
  out="$STATE/dry-run/$(date +%Y%m%d-%H%M%S)-$(basename "$PROMPT" .md)"
  mkdir -p "$out"
  worktree="${TMPDIR:-/tmp}/janus-weekly-dry-$$"
  git worktree add -q --detach "$worktree" HEAD
  trap cleanup EXIT
  review "$worktree" "$out" dry-run || fail "Dry run for $WEEK failed (code $?)."
  git -C "$worktree" add -A
  git -C "$worktree" diff --cached >"$out/weekly.diff"
  log "dry run for $WEEK written to $out"
  echo "Dry run for $WEEK: $out/pr-body.md and $out/weekly.diff" >&3
}

case "$MODE" in
  "") run ;;
  catch-up)
    if [[ -f "$FAILED" ]]; then
      cat "$FAILED" >&4
      rm -f "$FAILED"
      exit 1
    fi
    due || exit 0
    [[ -d "$LOCK" ]] && kill -0 "$(cat "$LOCK/pid" 2>/dev/null || echo 0)" 2>/dev/null && exit 0
    nohup "$0" </dev/null 3>&- 4>&- &
    echo "Weekly review of $WEEK started; it comes back as a PR." >&3
    ;;
  dry-run) dry_run ;;
esac
