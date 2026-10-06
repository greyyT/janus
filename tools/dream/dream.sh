#!/usr/bin/env bash
# Janus Dream. Moves the uncommitted changes out of the main checkout into a
# worktree on a dream/* branch, lets pi consolidate them with the days' Janus
# conversations, then opens or updates the dream PR.
#
#   dream.sh                  dream now when due (launchd runs this at 03:00)
#   dream.sh catch-up         report an unseen failure, or when due, move the changes
#                             and finish in the background (run before Greyy's prompts)
#   dream.sh --dry-run        dream the latest day on a copy of the uncommitted changes;
#                             write the PR body and Dream's diff under .janus/dream/dry-run/,
#                             then discard the worktree: nothing moves, commits, or pushes
#   --prompt PATH             with the default mode or --dry-run: another prompt file
#                             instead of tools/dream/prompt.md, relative to the Janus root
#
# The prompt file may use {{days}}, {{root}}, {{changes_commit}}, {{pr_body}},
# and {{previous_pr_body}}; it is read before the changes move.
#
# A day is due once it is past 03:00 the next morning and .janus/dream/last
# (the last day dreamed) is older. Authority: "Dream commits and opens its PR"
# in brain/Grants.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/.janus/dream"
LAST="$STATE/last"
LOCK="$STATE/lock"
RUN_ENV="$STATE/run.env"
FAILED="$STATE/failed"
LOG="$STATE/dream.log"
MODE=""
PROMPT="$ROOT/tools/dream/prompt.md"
while (( $# )); do
  case "$1" in
    --prompt) PROMPT="${2:?--prompt needs a path}"; shift 2 ;;
    --dry-run) MODE=dry-run; shift ;;
    catch-up | run) MODE=$1; shift ;;
    *) echo "usage: dream.sh [catch-up | [--dry-run] [--prompt PATH]]" >&2; exit 2 ;;
  esac
done
[[ "$PROMPT" == /* ]] || PROMPT="$ROOT/$PROMPT"
[[ -f "$PROMPT" ]] || { echo "no prompt file at $PROMPT" >&2; exit 2; }
mkdir -p "$STATE"
cd "$ROOT"
# Tool output goes to the log; messages meant for Greyy use fd 3 (out) and 4 (err).
exec 3>&1 4>&2 >>"$LOG" 2>&1

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }
next_day() { date -j -v+1d -f %F "$1" +%F; }
dream_target() { date -v-3H -v-1d +%F; }

# Greyy sees a catch-up failure at once; any other failure on his next prompt.
fail() {
  log "$1"
  if [[ "$MODE" == catch-up || "$MODE" == dry-run ]]; then echo "$1 See $LOG." >&4; else echo "$1 See $LOG." >"$FAILED"; fi
  exit 1
}

release_lock() { rm -rf "$LOCK"; }

acquire_lock() {
  if ! mkdir "$LOCK" 2>/dev/null; then
    local holder
    holder=$(cat "$LOCK/pid" 2>/dev/null || true)
    if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
      [[ "$MODE" == dry-run ]] && echo "A dream is already running." >&4
      exit 0
    fi
    rm -rf "$LOCK" && mkdir "$LOCK"
  fi
  echo $$ >"$LOCK/pid"
  trap release_lock EXIT
}

render_prompt() { # template days changes_commit pr_body previous_pr_body
  local prompt
  prompt=$(<"$1")
  prompt=${prompt//'{{days}}'/"$2"}
  prompt=${prompt//'{{root}}'/"$ROOT"}
  prompt=${prompt//'{{changes_commit}}'/"$3"}
  prompt=${prompt//'{{pr_body}}'/"$4"}
  printf '%s' "${prompt//'{{previous_pr_body}}'/"$5"}"
}

# Before the day commit exists: returns the moved changes to the main checkout.
give_back() {
  if (( popped )); then git -C "$worktree" stash push -q -u -m "janus-dream $target"; fi
  if [[ -d "$worktree" ]]; then git worktree remove --force "$worktree"; fi
  git branch -D -q "$branch" 2>/dev/null || true
  git stash pop -q || log "changes kept in git stash: run git stash pop"
  fail "Dream through $target postponed: $1."
}

prepare() {
  local last day
  target=$(dream_target)
  last=$(cat "$LAST" 2>/dev/null || true)
  if [[ -n "$last" && ! "$last" < "$target" ]]; then exit 0; fi

  acquire_lock
  if ! curl -fsS --max-time 5 -o /dev/null https://api.github.com; then
    log "offline; dream through $target postponed"
    exit 0
  fi
  [[ "$(git symbolic-ref --short -q HEAD)" == main ]] || fail "Dream through $target postponed: the Janus checkout is not on main."
  cp "$PROMPT" "$STATE/prompt.md"

  local days=() has_sessions=0 sessions
  day=${last:+$(next_day "$last")}
  day=${day:-$target}
  while [[ ! "$day" > "$target" ]]; do
    days+=("$day")
    sessions=$(pnpm -s brain:sessions -- --date "$day" --json)
    [[ "$sessions" == *'"path"'* ]] && has_sessions=1
    day=$(next_day "$day")
  done
  local has_changes=0
  [[ -n "$(git status --porcelain)" ]] && has_changes=1
  if (( !has_sessions && !has_changes )); then
    echo "$target" >"$LAST"
    log "nothing to dream through $target"
    exit 0
  fi

  local base=HEAD is_rolling=0
  branch=$(gh pr list --state open --json headRefName --jq '[.[].headRefName | select(startswith("dream/"))][0] // empty')
  if [[ -n "$branch" ]]; then
    is_rolling=1
    base="origin/$branch"
  fi
  branch=${branch:-dream/$target}

  local popped=0
  worktree="${TMPDIR:-/tmp}/janus-dream-$target"
  day_commit=""
  git fetch -q origin
  # A closed or merged dream PR may have left a branch with this name behind.
  if (( !is_rolling )) && git rev-parse -q --verify "origin/$branch" >/dev/null; then branch+="-$(date +%H%M%S)"; fi
  git worktree prune
  (( has_changes )) && git stash push -q -u -m "janus-dream $target"
  git merge -q --ff-only origin/main || log "main checkout not fast-forwarded to origin/main"
  if (( has_changes )); then
    git worktree add -q -B "$branch" "$worktree" "$base" || give_back "cannot create the dream worktree"
    git -C "$worktree" stash pop -q || give_back "the uncommitted changes conflict with $branch"
    popped=1
    git -C "$worktree" add -A && git -C "$worktree" commit -q -m "janus: changes through $target" || give_back "cannot commit the uncommitted changes"
    day_commit=$(git -C "$worktree" rev-parse HEAD)
  else
    git worktree add -q -B "$branch" "$worktree" "$base"
  fi

  {
    printf 'target=%q\nbranch=%q\nis_rolling=%q\nworktree=%q\nday_commit=%q\nprompt_label=%q\n' "$target" "$branch" "$is_rolling" "$worktree" "$day_commit" "${PROMPT#"$ROOT/"}"
    printf 'days=(%s)\n' "${days[*]}"
  } >"$RUN_ENV"
  log "prepared $branch for ${days[*]} with ${PROMPT#"$ROOT/"}"
}

# Before anything is pushed: returns the day's changes to the main checkout,
# drops Dream's edits, and removes the dream worktree and local branch.
restore() {
  if [[ -n "$day_commit" ]]; then
    git -C "$worktree" reset -q --hard "$day_commit"
    git -C "$worktree" clean -fdq
    git -C "$worktree" reset -q HEAD~1
    git -C "$worktree" stash push -q -u -m "janus-dream restore $target"
  fi
  git worktree remove --force "$worktree"
  git branch -D -q "$branch"
  if [[ -n "$day_commit" ]]; then git stash pop -q || log "changes kept in git stash: run git stash pop"; fi
  rm -f "$RUN_ENV"
  fail "Dream through $target failed: $1; the uncommitted changes are back in the Janus checkout."
}

close_out() {
  echo "$target" >"$LAST"
  rm -f "$RUN_ENV"
  git worktree remove --force "$worktree"
  git branch -D -q "$branch"
}

run() {
  # shellcheck source=/dev/null
  source "$RUN_ENV"
  local body="$STATE/pr-body.md" previous="$STATE/previous-pr-body.md"
  rm -f "$body" "$previous"
  if (( is_rolling )); then gh pr view "$branch" --json body --jq .body >"$previous" || restore "cannot read the open dream PR"; fi

  local prompt previous_text=none
  (( is_rolling )) && previous_text=$previous
  prompt=$(render_prompt "$STATE/prompt.md" "${days[*]}" "${day_commit:-none}" "$body" "$previous_text")

  (cd "$worktree" && JANUS_DREAM=1 pi -p --no-session "$prompt") || restore "pi exited with an error"
  [[ -s "$body" ]] || restore "no PR body written"
  printf '\n_Prompt: `%s`_\n' "$prompt_label" >>"$body"

  git -C "$worktree" add -A
  git -C "$worktree" diff --cached --quiet || git -C "$worktree" commit -q -m "dream: ${days[*]}" || restore "cannot commit Dream's changes"
  if [[ -z "$(git -C "$worktree" rev-list origin/main..HEAD)" ]]; then
    close_out
    log "dreamed ${days[*]}; nothing changed"
    return
  fi

  git -C "$worktree" push -q -u origin "$branch" || restore "push failed"
  # The changes are on GitHub now; never restore past this point.
  local title="dream: ${days[0]}"
  (( ${#days[@]} > 1 )) && title+=" to $target"
  if (( is_rolling )); then
    gh pr edit "$branch" --body-file "$body" >/dev/null || { close_out; fail "Dream pushed $branch but could not update the PR body: run gh pr edit $branch --body-file $body."; }
  else
    gh pr create --base main --head "$branch" --title "$title" --body-file "$body" >/dev/null || { close_out; fail "Dream pushed $branch but could not open the PR: run gh pr create --head $branch --body-file $body."; }
  fi
  close_out
  log "dreamed ${days[*]} on $branch"
}

# Dreams the latest day on a throwaway worktree holding a copy of the
# uncommitted changes. The checkout, `.janus/dream/last`, and GitHub stay untouched.
dry_run() {
  acquire_lock
  target=$(dream_target)
  local out changes=none prompt
  # Global: the EXIT trap removes it after this function returns.
  dry_worktree="${TMPDIR:-/tmp}/janus-dream-dry-$$"
  out="$STATE/dry-run/$(date +%Y%m%d-%H%M%S)-$(basename "$PROMPT" .md)"
  mkdir -p "$out"
  git worktree add -q --detach "$dry_worktree" HEAD
  trap 'git worktree remove --force "$dry_worktree"; release_lock' EXIT
  if ! git diff --quiet HEAD; then git diff --binary HEAD | git -C "$dry_worktree" apply --binary; fi
  git ls-files -z -o --exclude-standard | tar --null -T - -cf - | tar -xf - -C "$dry_worktree"
  git -C "$dry_worktree" add -A
  if ! git -C "$dry_worktree" diff --cached --quiet; then
    git -C "$dry_worktree" commit -q -m "janus: changes through $target (dry run)"
    changes=$(git -C "$dry_worktree" rev-parse HEAD)
  fi

  prompt=$(render_prompt "$PROMPT" "$target" "$changes" "$out/pr-body.md" none)
  (cd "$dry_worktree" && JANUS_DREAM=1 pi -p --no-session "$prompt") || fail "Dry run for $target failed: pi exited with an error."
  git -C "$dry_worktree" add -A
  git -C "$dry_worktree" diff --cached >"$out/dream.diff"
  log "dry run for $target with ${PROMPT#"$ROOT/"} written to $out"
  echo "Dry run for $target with ${PROMPT#"$ROOT/"}: $out/pr-body.md and $out/dream.diff" >&3
}

case "$MODE" in
  "")
    prepare
    run
    ;;
  catch-up)
    if [[ -f "$FAILED" ]]; then
      cat "$FAILED" >&4
      rm -f "$FAILED"
      exit 1
    fi
    prepare
    trap - EXIT
    nohup "$0" run </dev/null 3>&- 4>&- &
    echo $! >"$LOCK/pid"
    echo "Dream started for the days through $target: the uncommitted changes moved to $branch and come back as a PR." >&3
    ;;
  run)
    trap release_lock EXIT
    run
    ;;
  dry-run)
    dry_run
    ;;
esac
