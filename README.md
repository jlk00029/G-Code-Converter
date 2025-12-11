# G-Code-Converter — Static Image to G-code Web UI

This adds a small static webpage that converts a dropped image into a simple raster G-code file suitable for pen plotters or laser engravers (GRBL-style commands).

Updates in this change:
- Added per-pixel laser power (grayscale mapping) mode. When laser grayscale mode is selected the preview shows a true grayscale image and the generator emits per-pixel M3 S... / M5 commands, mapping image darkness to S (0..laserMaxS).
- Laser grayscale mode avoids dithering and treats near-white pixels as off to reduce unnecessary laser-on moves. There is still an "Optimize paths" option to reorder runs.

Files updated:
- index.html — UI updated with Laser power mode and Laser max S options
- gcode-generator.js — client-side logic updated to support per-pixel laser power in grayscale mode
- README.md — notes about the new feature

How it works:
- In "Laser (grayscale)" mode the page keeps the raw grayscale image (0..255), maps darker pixels to higher S values and emits per-pixel movements for runs, switching M3/M5 when the S value changes. This produces variable-power engraving directly from the image grayscale.

Notes and safety:
- Per-pixel mode generates many G-code commands (one move per pixel in drawn runs). Use with caution and test on short samples first.
- Verify your controller supports frequent M3/M5 or S changes; some firmwares expect laser PWM commands handled differently (e.g., using spindle-synchronous modes). This generator uses M3 S<value> / M5 which is commonly supported by GRBL-compatible laser forks.
- Always test with low power and an emergency stop available.
