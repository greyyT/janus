## Ping criteria

Greyy's current rule for when a coordinator result may interrupt him on Telegram. He can change it any time; edit this file and record the change through the decisions skill. It is re-read on every run.

Call `ping_user` only when a coordinator result leaves one of these, after you have recorded it in the ticket:

- a blocker only Greyy can clear: access, a credential, an external person, or a live check;
- a grant-gated action with no applicable grant;
- a ticket whose whole outcome appears met and awaits his `done`;
- a `failed` result you cannot correct within scope.

Everything else is recorded silently: routine decisions, non-blocking questions, completed intermediate steps. Send at most one ping per result, naming the ticket by title and ID and what he must do.
