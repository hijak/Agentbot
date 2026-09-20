/** Sampled luminance stats for a desktop preview frame. */
export function frameLooksBlankFromLuma(samples: Float64Array): boolean {
  if (samples.length === 0) return true;
  let sum = 0;
  let sumSq = 0;
  let lit = 0;
  for (const lum of samples) {
    sum += lum;
    sumSq += lum * lum;
    if (lum > 0.08) lit += 1;
  }
  const mean = sum / samples.length;
  const variance = sumSq / samples.length - mean * mean;
  // Screensaver / DPMS blank: almost no light, or a flat single color.
  return lit / samples.length < 0.03 || variance < 0.0008;
}

function sampleLuma(source: HTMLCanvasElement): Float64Array {
  const sample = document.createElement("canvas");
  sample.width = 48;
  sample.height = 27;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return new Float64Array(0);
  context.drawImage(source, 0, 0, sample.width, sample.height);
  const { data } = context.getImageData(0, 0, sample.width, sample.height);
  const samples = new Float64Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    samples[j] = (data[i]! * 0.2126 + data[i + 1]! * 0.7152 + data[i + 2]! * 0.0722) / 255;
  }
  return samples;
}

/** True when the frame is near-black or a flat wash (idle/screensaver). */
export function frameLooksBlank(source: HTMLCanvasElement): boolean {
  if (source.width < 2 || source.height < 2) return true;
  return frameLooksBlankFromLuma(sampleLuma(source));
}
