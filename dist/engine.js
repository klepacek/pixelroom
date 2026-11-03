export const formats = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
export function dimensions(
  width,
  height,
  maxWidth,
  maxHeight,
  allowUpscale = false,
) {
  const scale = Math.min(
    maxWidth / width,
    maxHeight / height,
    allowUpscale ? Infinity : 1,
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function fileName(name, ext, suffix = "edited") {
  return `${name.replace(/\.[^.]+$/, "")}-${suffix}.${ext}`;
}
export function bytes(n) {
  return n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(2)} MB`;
}
export function cropBounds(crop, width, height) {
  const x = clamp(crop.x, 0, width - 1),
    y = clamp(crop.y, 0, height - 1);
  return {
    x,
    y,
    width: clamp(crop.width, 1, width - x),
    height: clamp(crop.height, 1, height - y),
  };
}
export function renderImage(source, settings) {
  const crop = cropBounds(settings.crop, source.width, source.height);
  const turn = ((settings.rotation % 360) + 360) % 360;
  const sideways = turn === 90 || turn === 270;
  const baseW = sideways ? crop.height : crop.width,
    baseH = sideways ? crop.width : crop.height;
  const size = dimensions(
    baseW,
    baseH,
    settings.width || baseW,
    settings.height || baseH,
    settings.upscale,
  );
  if (size.width * size.height > 40000000)
    throw new Error("Output exceeds 40 megapixels. Choose smaller dimensions.");
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (settings.format === "jpg") {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  ctx.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) grayscale(${settings.grayscale}%)`;
  const drawW = sideways ? size.height : size.width,
    drawH = sideways ? size.width : size.height;
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -drawW / 2,
    -drawH / 2,
    drawW,
    drawH,
  );
  ctx.restore();
  if (settings.watermark.trim()) {
    const fontSize = Math.max(
      12,
      Math.round((canvas.width * settings.watermarkSize) / 100),
    );
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.globalAlpha = settings.opacity / 100;
    ctx.fillStyle = settings.watermarkColor;
    ctx.shadowColor = "#0008";
    ctx.shadowBlur = 3;
    ctx.fillText(
      settings.watermark,
      canvas.width - 24,
      canvas.height - 24,
      canvas.width - 48,
    );
    ctx.globalAlpha = 1;
  }
  return canvas;
}
export function encode(canvas, format, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.type === formats[format]
          ? resolve(blob)
          : reject(
              new Error(
                `${format.toUpperCase()} encoding is not supported in this browser.`,
              ),
            ),
      formats[format],
      quality / 100,
    ),
  );
}
