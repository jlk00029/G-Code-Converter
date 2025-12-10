// Image -> G-code generator with improved preview overlay and path optimization
(function(){
  const $ = id => document.getElementById(id);
  const imgfile = $('imgfile');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const previewBtn = $('previewBtn');
  const generateBtn = $('generateBtn');
  const downloadBtn = $('downloadBtn');
  const gcodeOut = $('gcode');

  let img = new Image();
  let imgLoaded = false;
  let lastRuns = null; // cached runs for preview/optimization

  imgfile.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    imgLoaded = false;
    img = new Image();
    img.onload = () => { imgLoaded = true; URL.revokeObjectURL(url); };
    img.src = url;
  });

  previewBtn.addEventListener('click', () => {
    if(!imgLoaded){ alert('Please choose an image first.'); return; }
    renderPreview();
  });

  generateBtn.addEventListener('click', () => {
    if(!imgLoaded){ alert('Please choose an image first.'); return; }
    renderPreview();
    const gcode = generateGcode();
    gcodeOut.value = gcode;
    downloadBtn.disabled = false;
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([gcodeOut.value], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'output.nc';
    a.click();
  });

  function renderPreview(){
    const widthMm = parseFloat($('widthMm').value) || 100;
    const pxPerMm = parseFloat($('pxPerMm').value) || 5;
    const pxWidth = Math.max(1, Math.round(widthMm * pxPerMm));
    const scale = pxWidth / img.width;
    const pxHeight = Math.max(1, Math.round(img.height * scale));

    canvas.width = pxWidth;
    canvas.height = pxHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const useDither = $('dither').checked;
    const invert = $('invert').checked;

    const imgd = ctx.getImageData(0,0,canvas.width,canvas.height);
    const gray = new Uint8ClampedArray(canvas.width * canvas.height);
    for(let i=0, j=0;i<imgd.data.length;i+=4,j++){
      const r = imgd.data[i], g=imgd.data[i+1], b=imgd.data[i+2];
      gray[j] = (0.299*r + 0.587*g + 0.114*b)|0;
    }

    if(useDither){
      floydSteinbergDither(gray, canvas.width, canvas.height, invert);
    } else {
      const threshold = 128;
      for(let i=0;i<gray.length;i++){
        const v = invert ? 255 - gray[i] : gray[i];
        gray[i] = (v < threshold) ? 0 : 255;
      }
    }

    const out = ctx.createImageData(canvas.width, canvas.height);
    for(let i=0, j=0;i<out.data.length;i+=4,j++){
      const v = gray[j];
      out.data[i]=out.data[i+1]=out.data[i+2]=v;
      out.data[i+3]=255;
    }
    ctx.putImageData(out,0,0);

    // build runs for preview/generation
    const map = new Uint8Array(canvas.width * canvas.height);
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const v = out.data[(y*canvas.width + x)*4];
        map[y*canvas.width + x] = v < 128 ? 1 : 0; // black=1 (draw)
      }
    }

    const pixelSize = 1 / pxPerMm;
    const runs = collectRuns(map, canvas.width, canvas.height, pixelSize);
    lastRuns = runs;

    // optional toolpath overlay (improved)
    if($('showPath').checked){
      drawToolpath(runs);
    }
  }

  function floydSteinbergDither(pixels, w, h, invert){
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx = y*w + x;
        let oldVal = pixels[idx];
        if(invert) oldVal = 255 - oldVal;
        const newVal = oldVal < 128 ? 0 : 255;
        const err = oldVal - newVal;
        pixels[idx] = newVal;
        if(x+1 < w) pixels[idx+1] = clamp(pixels[idx+1] + err * 7/16);
        if(x-1 >=0 && y+1 < h) pixels[idx + w -1] = clamp(pixels[idx + w -1] + err * 3/16);
        if(y+1 < h) pixels[idx + w] = clamp(pixels[idx + w] + err * 5/16);
        if(x+1 < w && y+1 < h) pixels[idx + w +1] = clamp(pixels[idx + w +1] + err * 1/16);
      }
    }
  }
  function clamp(v){ return Math.max(0, Math.min(255, v)); }

  function collectRuns(map, w, h, pixelSize){
    const runs = [];
    for(let y=0;y<h;y++){
      let x=0;
      while(x<w){
        const idx = y*w + x;
        if(map[idx]){
          let start = x;
          let end = x;
          while(end+1 < w && map[y*w + end+1]) end++;
          runs.push({
            xStart: start,
            xEnd: end,
            y: y,
            // mm coordinates (start inclusive, end exclusive at xEnd+1)
            x_mm_start: start * pixelSize,
            x_mm_end: (end+1) * pixelSize,
            y_mm: y * pixelSize
          });
          x = end+1;
        } else {
          x++;
        }
      }
    }
    return runs;
  }

  function drawToolpath(runs){
    ctx.save();

    // draw semi-transparent overlay on top of the dithered image
    const strokeWidth = Math.max(1, Math.min(3, canvas.width/300));
    ctx.lineWidth = strokeWidth;

    // if optimizing, show optimized ordering and travel moves
    const optimize = $('optimize').checked;
    const ordered = optimize ? optimizeRunsGreedy(runs) : runs.map(r => ({run:r, dir:1}));

    // compute total travel length (mm) and optionally draw travel moves
    let totalTravelPx = 0;
    let prevEnd = null;

    // draw runs (red)
    ctx.strokeStyle = 'rgba(255,0,0,0.9)';
    ctx.fillStyle = 'rgba(255,0,0,0.9)';
    for(const item of ordered){
      const r = item.run;
      const dir = item.dir;
      const sx_px = (dir===1 ? r.xStart : r.xEnd + 1) + 0.5; // pixel coords (center)
      const ex_px = (dir===1 ? r.xEnd + 1 : r.xStart) - 0.5;
      const y_px = r.y + 0.5;

      ctx.beginPath();
      ctx.moveTo(sx_px, y_px);
      ctx.lineTo(ex_px, y_px);
      ctx.stroke();

      // small arrow at the end showing direction
      drawArrowHead(ex_px, y_px, dir===1 ? 0 : Math.PI, strokeWidth*2);

      // draw small start dot for clarity
      ctx.beginPath();
      ctx.arc(sx_px, y_px, Math.max(1, strokeWidth/1.5), 0, Math.PI*2);
      ctx.fill();

      if(prevEnd){
        const dx = sx_px - prevEnd.x;
        const dy = y_px - prevEnd.y;
        totalTravelPx += Math.hypot(dx,dy);
      }

      prevEnd = { x: ex_px, y: y_px };
    }

    // draw travel moves explicitly if optimized: (blue dashed lines between runs)
    if(optimize && ordered.length > 0){
      ctx.lineWidth = Math.max(0.7, strokeWidth/1.5);
      ctx.setLineDash([4,4]);
      ctx.strokeStyle = 'rgba(0,120,255,0.8)';

      let prev = null;
      for(const item of ordered){
        const r = item.run;
        const dir = item.dir;
        const sx_px = (dir===1 ? r.xStart : r.xEnd + 1) + 0.5;
        const ex_px = (dir===1 ? r.xEnd + 1 : r.xStart) - 0.5;
        const y_px = r.y + 0.5;

        if(prev){
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(sx_px, y_px);
          ctx.stroke();
        }
        prev = { x: ex_px, y: y_px };
      }
      ctx.setLineDash([]);
    }

    // info overlay (run count, estimated travel length in mm)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(6,6,200,44);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    const runCount = runs.length;
    const pxPerMm = parseFloat($('pxPerMm').value) || 5;
    const travelMm = (totalTravelPx / pxPerMm).toFixed(02);
    ctx.fillText(`Runs: ${runCount}`, 12, 22);
    ctx.fillText(`Optimized: ${optimize ? 'yes' : 'no'}`, 12, 38);
    ctx.fillText(`Est. travel: ${travelMm} mm`, 120, 22);

    ctx.restore();
  }

  function drawArrowHead(x, y, angle, size){
    // default angle 0 is to the right, PI to the left
    if(typeof angle === 'undefined') angle = 0;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-size, -size/2);
    ctx.lineTo(-size, size/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Improved greedy optimizer: chooses nearest run end from current point, returns ordered with directions
  function optimizeRunsGreedy(runs){
    const remaining = runs.slice();
    const ordered = [];
    let cx = 0, cy = 0; // current position in pixel coordinates (start at origin)

    while(remaining.length){
      let bestIdx = -1;
      let bestDist = Infinity;
      let bestDir = 1;

      for(let i=0;i<remaining.length;i++){
        const r = remaining[i];
        // compute pixel coordinates for potential start points
        const sx = r.xStart;
        const ex = r.xEnd + 1; // exclusive end -> next pixel
        const sy = r.y;

        const dToStart = Math.hypot(cx - sx, cy - sy);
        const dToEnd = Math.hypot(cx - ex, cy - sy);

        if(dToStart < bestDist){ bestDist = dToStart; bestIdx = i; bestDir = 1; }
        if(dToEnd < bestDist){ bestDist = dToEnd; bestIdx = i; bestDir = -1; }
      }

      const chosen = remaining.splice(bestIdx, 1)[0];
      ordered.push({ run: chosen, dir: bestDir });

      // update current position to the far end after traversing the run
      if(bestDir === 1){ cx = chosen.xEnd + 1; cy = chosen.y; } else { cx = chosen.xStart; cy = chosen.y; }
    }

    return ordered;
  }

  function generateGcode(){
    const pxPerMm = parseFloat($('pxPerMm').value) || 5;
    const wPx = canvas.width;
    const hPx = canvas.height;
    const pixelSize = 1 / pxPerMm; // mm per pixel
    const feed = parseFloat($('feed').value) || 1200;
    const zTravel = parseFloat($('zTravel').value) || 5;
    const zPlunge = parseFloat($('zPlunge').value) || -1;
    const mode = $('mode').value;
    const optimize = $('optimize').checked;

    const lines = [];
    lines.push('; Generated by G-Code-Converter simple client generator');
    lines.push('G21 ; mm');
    lines.push('G90 ; absolute');
    lines.push('G0 Z' + zTravel.toFixed(3));

    if(!lastRuns) return lines.join('\n');
    let runs = lastRuns.slice();

    let ordered;
    if(optimize){
      ordered = optimizeRunsGreedy(runs);
    } else {
      ordered = runs.map(r=>({run:r, dir:1}));
    }

    // start at home
    let curX = 0, curY = 0;

    for(const item of ordered){
      const r = item.run;
      const dir = item.dir;
      const xStart_px = dir===1 ? r.xStart : r.xEnd+1;
      const xEnd_px = dir===1 ? r.xEnd+1 : r.xStart;
      const y_px = r.y;
      const xStart_mm = (Math.max(0, Math.min(wPx, xStart_px)) * pixelSize).toFixed(3);
      const xEnd_mm = (Math.max(0, Math.min(wPx, xEnd_px)) * pixelSize).toFixed(3);
      const y_mm = (y_px * pixelSize).toFixed(3);

      // rapid to start
      lines.push(`G0 X${xStart_mm} Y${y_mm}`);
      if(mode === 'laser'){
        lines.push('M3 S255');
        lines.push(`G1 X${xEnd_mm} Y${y_mm} F${feed}`);
        lines.push('M5');
      } else {
        lines.push(`G1 Z${zPlunge.toFixed(3)} F${feed}`);
        lines.push(`G1 X${xEnd_mm} Y${y_mm} F${feed}`);
        lines.push(`G1 Z${zTravel.toFixed(3)} F${feed}`);
      }
      curX = parseFloat(xEnd_mm);
      curY = parseFloat(y_mm);
    }

    lines.push('G0 Z' + zTravel.toFixed(3));
    lines.push('G0 X0 Y0');
    if(mode === 'laser') lines.push('M5');
    lines.push('; end');
    return lines.join('\n');
  }

})();