# Zarman dashboard motion icons

These seven icons are original vector artwork created for the Zarman dashboard.
They are inspired by LottieFiles' approach to coherent, purposeful animated
icons, rather than copied or downloaded from a LottieFiles creator. There is no
third-party artwork or attribution dependency.

The source of truth is `scripts/generate-dashboard-motion-icons.cjs`. Each icon
has a 64 x 64 Lottie JSON animation and a matching static SVG final-state poster.
Both are generated from exactly the same cubic paths. Graphite outlines, violet
accents, emerald confirmations and amber action cues match the dashboard palette.

- `review`: document and clock; awaiting review, never a success symbol.
- `verify`: identity card; identity verification, without claiming approval.
- `upload`: receipt and upload glyph; the customer's receipt action.
- `received`: bank and confirmation; cleared funds acknowledged by the admin.
- `complete`: completion seal and check; an explicitly confirmed outcome such as a completed transfer, approved identity or submitted feedback.
- `recipients`: two people; the customer's saved recipients.
- `attention`: attention ring; a genuine action requirement.

Animations last 1.6 seconds (48 frames at 30 fps). Each finishes drawing before
frame 44 and rests until frame 47. They contain only shape paths, fills, rounded
strokes, opacity keyframes and trim paths supported by the installed Lottie SVG
renderer. There are no expressions, raster images, fonts, text or external URLs.
They are authored for one-shot playback; looping is a player setting and must be
disabled. The static SVG is the reduced-motion and loading/error fallback.

Regenerate: `node scripts/generate-dashboard-motion-icons.cjs`

Validate determinism, vector-only structure, final frames and byte budgets:
`node scripts/generate-dashboard-motion-icons.cjs --check`
