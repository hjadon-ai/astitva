# Immersive scenery

Generated using the built-in imagegen tool for F039 Phase 2. Scenery only: no UI, sample people, or reference-image content. Original generated PNGs remain outside the repository; these local runtime assets have no external service dependency.

Each Day/Night scene has a 1600×1067 desktop variant and a centered 768×1024 mobile crop in AVIF and WebP. Optimized using Pillow (Lanczos, RGB, metadata omitted; WebP quality 73, AVIF quality 58). CSS selects only the active Immersive theme/viewport; Original references no scenic image. Gradient/canvas fallback remains usable when images fail.

| Scene | Desktop WebP / AVIF bytes | Mobile WebP / AVIF bytes |
| --- | --- | --- |
| Day | 293018 / 214671 | 109406 / 83625 |
| Night | 208864 / 177812 | 80568 / 70703 |

## Final generation prompts

Day:

> Use case: stylized-concept. Generate a single wide 3:2 landscape artwork for a premium personal-life web application's decorative background. Daytime alpine lake with distant blue mountains, clear soft blue sky and delicate white clouds, lush natural garden foliage framing edges, a graceful leafy tree with very subtle lavender blossoms near the upper center, sunlit stone terrace near bottom. Elegant luminous atmospheric digital matte painting, refined realistic natural textures, serene and sophisticated, soft lavender/pink accents among natural greens and blues. Composition has quiet low-detail broad central region for overlaid functional UI; detail primarily at perimeter and bottom. Absolutely no people, faces, text, logos, icons, frames, cards, charts, interface or dashboard. Image fills entire canvas. This is scenery only, not a mockup.

Night:

> Use case: stylized-concept. Asset type: wide 3:2 decorative scenic background for a premium personal-life web app. A serene alpine lake and distant mountains at NIGHT, luminous flowering tree near upper center with violet and pink blossoms, deep midnight-blue sky with subtle stars, warm pink/lavender atmospheric glow near horizon and small firefly-like points of light among garden foliage at perimeter, stone terrace at bottom. Sophisticated realistic digital matte painting, elegant restrained magical atmosphere. Quiet low-detail broad central region for overlaid functional UI; scenic detail primarily at outer edges and bottom. Rich midnight blue, purple, lavender and soft pink palette. No bright daylight sky. Absolutely no people, faces, text, logos, icons, frames, cards, interface, dashboard or charts. Scenery fills whole canvas.
