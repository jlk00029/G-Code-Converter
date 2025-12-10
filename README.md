# G-Code-Converter — Static Image to G-code Web UI

This adds a small static webpage that converts a dropped image into a simple raster G-code file suitable for pen plotters or laser engravers (GRBL-style commands).

Updates in this change:
- Improved toolpath preview overlay: the preview now draws runs in red with direction arrows, optional dashed blue travel lines between runs (when Optimize paths is enabled), and an information box with run count and estimated travel length.
- Improved "Optimize paths" option: a simple nearest-neighbour (greedy) ordering is applied to raster runs to reduce travel moves. The preview also visualizes the ordering so you can compare optimized vs non-optimized output before generating G-code.
- Minor structure and data clarifications: runs now include both pixel and mm coordinates to make previewing and generation consistent.

Files included:
- index.html — the UI (contains Optimize and Show toolpath options)
- gcode-generator.js — client-side logic (image processing, dithering, run collection, improved preview overlay and greedy path optimization)
- style.css — small stylesheet

How to test locally:
1. Open index.html in a modern browser (Chrome/Edge/Firefox). No server needed.
2. Choose an image, set Width (mm) and Resolution (px/mm). Click Preview to see the dithered image and optional toolpath. Toggle Optimize paths to compare outputs and see travel visualization.
3. Click Generate G-code and download the .nc file. Verify the generated G-code and test cautiously on hardware.

Safety reminder: verify Z heights, feed rates and power settings before running G-code on hardware.
