# G-Code-Converter — Static Image to G-code Web UI

This adds a small static webpage that converts a dropped image into a simple raster G-code file suitable for pen plotters or laser engravers (GRBL-style commands).

Files added:
- index.html — the UI
- gcode-generator.js — client-side logic (image processing & G-code generation)
- style.css — small stylesheet

How to test locally:
1. Open index.html in a modern browser (Chrome/Edge/Firefox). No server needed.
2. Choose an image, set Width (mm) and Resolution (px/mm). Click Preview then Generate G-code.
3. Download the .nc file and send it to your machine. This generator outputs simple raster moves (G0/G1 and Z moves or M3/M5 for laser).

GitHub Pages:
- The page is static and works with the default static GitHub Pages workflow. Once pushed to the repository's main branch the typical GitHub Pages action (if enabled) will publish it. You can also serve index.html directly via the repository's Pages settings.

Notes & improvements:
- This implementation performs a simple Floyd–Steinberg dithering for better raster detail and produces per-row runs to reduce travel moves.
- The generated G-code is intentionally simple; verify safety (Z heights, feed rates) against your machine before running.

Example site for inspiration: https://dimasad.github.io/caex-drawbot-gcode/
