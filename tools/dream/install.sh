#!/usr/bin/env bash
# Installs the launchd job that runs tools/dream/dream.sh for this Janus
# checkout at 03:00 local time. launchd runs a job missed during sleep on wake;
# dream.sh itself skips while offline, and the catch-up before Greyy's next
# prompt covers the rest. The job keeps the PATH this script runs with, so pi,
# pnpm, gh, and git resolve as they do in Greyy's shell.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="com.janus.dream"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$ROOT/.janus/dream/launchd.log"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$ROOT/tools/dream/dream.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH</string></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL: runs $ROOT/tools/dream/dream.sh daily at 03:00. Plist: $PLIST"
