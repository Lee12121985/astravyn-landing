# Date Card Style Update

## What we'll do

- Restyle calendar day cells into square cards with gradient, shadow, and tighter status chip sizing.
- Replace comment button/tooltip behavior to show comment pill only on hover (no box around icon) using existing chat emoji.
- Keep current logic for status cycling and comments; adjust CSS/DOM only.

## Files to edit

- `timesheet/index.html` — update CSS for `.day`, `.pill`, `.comment-btn`, `.comment-sample`, and related markup/states if needed.

## Steps

1) Update calendar CSS: square cards, gradient/shadow, hover lift, compact status chip, status-specific colors; adjust day number positioning.

2) Adjust comment UI: keep chat emoji, remove box, hide preview by default; show pill on hover/focus only.