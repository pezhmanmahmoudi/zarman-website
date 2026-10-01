# Zarman dashboard motion icons

The seven JSON/SVG pairs in this directory are original vector artwork created for the Zarman dashboard.
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

## Customer-supplied LottieFiles animations

The `.lottie` archives added on 27 September 2026 are customer-supplied downloads,
separate from the original artwork above. They remain unchanged. Three selected
animations are extracted into `imported/` for the existing LottieLight SVG player;
their JSON is loaded on demand, with no additional player or runtime ZIP decoder.

| Original archive | Runtime file | Placement |
| --- | --- | --- |
| `Waiting P.lottie` | `imported/waiting.json` | Pending identity, transfer and receipt reviews |
| `Add to favorites.lottie` | `imported/reward.json` | Loyalty reward card |
| `loading animation.lottie` | `imported/loading.json` | Initial transfer data loading |

Each JSON comes from the archive's `animations/<manifest animation id>.json`,
serialized without extra whitespace. Artwork and animation timings are retained.
All three contain only vector layers and have no text, fonts, external images,
URLs or expressions. Their total uncompressed JSON size is approximately 87 KB.
The separate SVG posters are simple local fallback drawings of the same concepts.
The waiting and reward cues play once and retain their actual final frame. Only
the loading cue loops, and only while mounted for an actual pending read.
The dashboard pause preference, system reduced motion, viewport visibility and
background-tab pause apply to each cue in both languages.

The remaining archives stay available for future use. `Animation -
1714895807937.lottie` includes English lettering, while `Isometric data
analysis.lottie` is a larger 414 KB illustration; neither is placed in the
customer dashboard. Downloaded artwork retains its original source licensing;
the original-artwork statement above does not apply to these archives or their
extracted JSON.

## Customer dashboard scene map

The customer-supplied archives are extracted to `preview/` by
`node scripts/extract-dashboard-lottie-preview.mjs`. Runtime names and paths are
centralised in `lib/dashboard/lottie-scenes.ts`; UI code uses semantic names so
downloaded filenames never become workflow logic.

- `Bill Paid Successful`: receipt picker.
- `Add to favorites`: successful five-star feedback only.
- `alert`: transaction-reference and English-entry attention notices.
- `Announcement`: a message or announcement from Zarman.
- `Card Lottie Animation`: bank-account instructions.
- `Hand Loding`: the dashboard loading surface.
- `Gift Reward Animation`: first visit after unlocking a loyalty level.
- `compliance`: a real management/compliance wait.
- `Mobile payment`: the customer's payment step.
- `Payment Failed`: rejected or expired payment flow.
- `Payment Success`: customer funds confirmed by management.
- `payment sucessful`: final recipient settlement completed.
- `Profile Avatar for Child`: recipients page heading.
- `Review`: feedback page.
- `Send` / `Wrong fingerprint`: approved / rejected identity state.
- `warning`: closed, invalid or caution states.
- `Wallet _ Money Added`: cumulative loyalty savings.
- `Waiting P` / `loading animation`: refund waiting / transfer-data loading.

Every scene is decorative and sits beside authoritative text. The player is a
separate client chunk, JSON is fetched only near the viewport, background tabs
pause playback, global dashboard motion and `prefers-reduced-motion` are
respected, and only genuine loading/waiting states loop. Static Lucide artwork
is retained as a no-motion and load-failure fallback. `Animation -
1714895807937` remains available in the registry but is intentionally not
placed: its English lettering is unsuitable for a bilingual dashboard and an
extra loader would add noise.
