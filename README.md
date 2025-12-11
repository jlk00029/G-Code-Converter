# G-Code-Converter — Static Image to G-code Web UI

This adds a small static webpage that converts a dropped image into a simple raster G-code file suitable for pen plotters or laser engravers (GRBL-style commands).

Updates in this change:
- Added per-pixel laser power (grayscale mapping) mode. When laser grayscale mode is selected the preview shows a true grayscale image and the generator emits per-pixel M3 S... / M5 commands, mapping image darkness to S (0..laserMaxS).
- Added SVG export of optimized runs for easy visual review. Use the Export SVG button after previewing to download an SVG showing the computed runs (ordered if Optimize paths is enabled). For grayscale mode the SVG strokes' opacity reflects averaged pixel darkness for each run.
- Laser grayscale mode avoids dithering and treats near-white pixels as off to reduce unnecessary laser-on moves. There is still an "Optimize paths" option to reorder runs.

Files updated:
- index.html — UI updated with Export SVG button and Laser power options
- gcode-generator.js — client-side logic updated to support SVG export, per-pixel laser power in grayscale mode
- README.md — notes about the new feature and SVG export

How it works:
- In "Laser (grayscale)" mode the page keeps the raw grayscale image (0..255), maps darker pixels to higher S values and emits per-pixel movements for runs, switching M3/M5 when power changes. This produces variable-power engraving directly from the image grayscale.
- Export SVG builds a simple SVG file where each raster run becomes a <line> drawn in mm units. If optimization is enabled the runs are ordered using the same greedy optimizer used for G-code generation. For grayscale mode the stroke-opacity of each line reflects the average darkness of pixels in the run.

Notes and safety:
- Per-pixel mode generates many G-code commands (one move per pixel in drawn runs). Use with caution and test on short samples first.
- Verify your controller supports frequent M3/M5 or S changes; some firmwares expect laser PWM commands handled differently (e.g., using spindle-synchronous modes). This generator uses M3 S<value> / M5 which is commonly supported by GRBL-compatible laser forks.
- The exported SVG is for review and visualization only; coordinates are in millimeters matching the configured Width and Resolution.
- Always test with low power and an emergency stop available.

Please push these changes to the repository main branch.
