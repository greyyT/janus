---
description: Add a Google Calendar iCal feed link to Janus. Use for /calendar-add.
---

# Janus Calendar Add

Add a read-only Google Calendar iCal feed to Janus.

## Flow

1. Ask the user to paste Google Calendar's `Secret address in iCal format` or a public iCal URL if they did not already provide one.
2. Ask for an optional display name only when the user did not provide one. Recommend `Work`, `Personal`, or `Calendar N`.
3. Run:

   ```sh
   pnpm brain:calendar:add -- --url "<URL>" --name "<NAME>" --json
   ```

4. Report the configured calendar name and remind the user that the URL is stored only under gitignored `.janus/calendar/config.json`.

Do not paste the secret URL back in chat after storing it.
