#!/usr/bin/env bash
# Installs the launchd job that runs tools/weekly/weekly.sh for this Janus
# checkout every Monday at 04:00 local time, an hour after Dream. launchd runs
# a job missed during sleep on wake; the catch-up before the user's next
# prompt covers the rest. The job keeps the PATH this script runs with.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="com.janus.weekly"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$ROOT/.janus/weekly/launchd.log"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$ROOT/tools/weekly/weekly.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH</string></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL: runs $ROOT/tools/weekly/weekly.sh Mondays at 04:00. Plist: $PLIST"
