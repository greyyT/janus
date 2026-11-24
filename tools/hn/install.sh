#!/usr/bin/env bash
# Installs the launchd job that runs tools/hn/hn.sh daily at 04:30 local time
# (after Dream at 03:00, before the morning). launchd runs a job missed
# during sleep on wake. Re-run to update; `launchctl bootout gui/$(id -u)/com.janus.hn` removes it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL=com.janus.hn
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$ROOT/.janus/hn/launchd.log"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$ROOT/tools/hn/hn.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>30</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH</string></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL: runs $ROOT/tools/hn/hn.sh daily at 04:30. Plist: $PLIST"
