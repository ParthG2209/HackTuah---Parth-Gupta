/**
 * PaletteExtractor.js
 * ─────────────────────────────────────────────────────────────────────────
 * Direct JS/Canvas port of `AnimatedArtworkView.extractPaletteAndDominant`
 * (Swift/CoreImage).
 * ─────────────────────────────────────────────────────────────────────────
 */

function rgbToHsb(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

function hsbToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (((i % 6) + 6) % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [r, g, b];
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const fmod1 = (x) => ((x % 1) + 1) % 1;

export class PaletteExtractor {
  static extractPaletteAndDominant(image, count = 5) {
    const { width, height, data } = PaletteExtractor._getPixelData(image);
    if (width === 0 || height === 0) {
      return PaletteExtractor._fallback(count);
    }

    const cols = 3, rows = 3;
    const cellW = width / cols;
    const cellH = height / rows;
    const regions = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        regions.push({
          x: col * cellW,
          y: row * cellH,
          w: cellW,
          h: cellH,
        });
      }
    }
    const centerCrop = {
      x: width * 0.25,
      y: height * 0.25,
      w: width * 0.5,
      h: height * 0.5,
    };
    regions.push(centerCrop); 

    const sampled = regions.map((r) => PaletteExtractor._averageRegion(data, width, height, r));

    if (sampled.length === 0) {
      return PaletteExtractor._fallback(count);
    }

    const centerSample = sampled[sampled.length - 1] || sampled[0];
    const dominant = [centerSample.r, centerSample.g, centerSample.b, 1];

    const picked = [sampled.length - 1];
    const target = Math.min(count, sampled.length);
    while (picked.length < target) {
      let bestIdx = -1;
      let bestMinDist = -1;
      for (let i = 0; i < sampled.length; i++) {
        if (picked.includes(i)) continue;
        const c = sampled[i];
        let minDist = Infinity;
        for (const pi of picked) {
          const p = sampled[pi];
          const dr = c.r - p.r, dg = c.g - p.g, db = c.b - p.b;
          const d = dr * dr + dg * dg + db * db;
          if (d < minDist) minDist = d;
        }
        if (minDist > bestMinDist) { bestMinDist = minDist; bestIdx = i; }
      }
      if (bestIdx >= 0) picked.push(bestIdx);
      else break;
    }

    let colors = picked.map((idx) => {
      const c = sampled[idx];
      const { h, s, v } = rgbToHsb(c.r, c.g, c.b);
      const [r, g, b] = hsbToRgb(h, Math.min(s * 1.2, 1.0), v);
      return [r, g, b, 1];
    });

    while (colors.length < count) {
      colors.push(colors.length > 0 ? colors[colors.length - 1] : [0.5, 0.0, 0.5, 1]); 
    }

    colors = PaletteExtractor._diversifyIfNeeded(colors);

    return { palette: colors, dominant };
  }

  static _diversifyIfNeeded(colors) {
    if (colors.length === 0) return colors;
    const hsb = colors.map(([r, g, b]) => rgbToHsb(r, g, b));
    const hues = hsb.map((c) => c.h);
    const brights = hsb.map((c) => c.v);
    const hueSpread = Math.max(...hues) - Math.min(...hues);
    const brightSpread = Math.max(...brights) - Math.min(...brights);
    const effectiveHueSpread = Math.min(hueSpread, 1.0 - hueSpread);

    if (effectiveHueSpread > 0.08 || brightSpread > 0.15) {
      return colors; 
    }

    const { h, s, v } = hsb[0];
    return [
      [...hsbToRgb(h, s, v), 1],
      [...hsbToRgb(fmod1(h + 0.04), Math.max(s - 0.1, 0.2), Math.min(v + 0.15, 1.0)), 1],
      [...hsbToRgb(fmod1(h - 0.05 + 1.0), Math.min(s + 0.15, 1.0), Math.max(v - 0.25, 0.15)), 1],
      [...hsbToRgb(fmod1(h + 0.08), Math.min(s + 0.1, 1.0), v), 1],
      [...hsbToRgb(h, Math.max(s - 0.3, 0.05), Math.min(v + 0.25, 1.0)), 1],
    ];
  }

  static _averageRegion(data, imgWidth, imgHeight, region) {
    const x0 = Math.max(0, Math.floor(region.x));
    const y0 = Math.max(0, Math.floor(region.y));
    const x1 = Math.min(imgWidth, Math.ceil(region.x + region.w));
    const y1 = Math.min(imgHeight, Math.ceil(region.y + region.h));

    let rSum = 0, gSum = 0, bSum = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      let rowOffset = (y * imgWidth + x0) * 4;
      for (let x = x0; x < x1; x++) {
        rSum += data[rowOffset];
        gSum += data[rowOffset + 1];
        bSum += data[rowOffset + 2];
        rowOffset += 4;
        n++;
      }
    }
    if (n === 0) return { r: 0, g: 0, b: 0 };
    return {
      r: rSum / n / 255,
      g: gSum / n / 255,
      b: bSum / n / 255,
    };
  }

  static _getPixelData(image, maxDim = 256) {
    let srcW = image.naturalWidth || image.width;
    let srcH = image.naturalHeight || image.height;
    if (!srcW || !srcH) return { width: 0, height: 0, data: null };

    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data };
  }

  static _fallback(count) {
    const fallbackPalette = [
      [0.5, 0.0, 0.5, 1],   // systemPurple-ish
      [0.0, 0.48, 1.0, 1],  // systemBlue-ish
      [0.19, 0.84, 0.78, 1],// systemTeal-ish
      [0.34, 0.34, 0.84, 1],// systemIndigo-ish
      [1.0, 0.18, 0.57, 1], // systemPink-ish
    ].slice(0, Math.max(1, count));
    return { palette: fallbackPalette, dominant: [0.5, 0.5, 0.5, 1] };
  }
}
