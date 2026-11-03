import { renderImage, encode, bytes, fileName, clamp } from "./engine.js";
const $ = (id) => document.getElementById(id);
const tools = [
  [
    "convert",
    "⇄",
    "Convert images",
    "New format. Same great image.",
    "Give your images the format they need. Keep every detail.",
  ],
  [
    "compress",
    "◫",
    "Compress",
    "Less weight. More room.",
    "Dial down file size and find the right balance of quality and detail.",
  ],
  [
    "resize",
    "⤢",
    "Resize",
    "The perfect fit.",
    "Set a bounding box. Your image keeps its proportions.",
  ],
  [
    "crop",
    "⌗",
    "Crop",
    "Keep the good part.",
    "Drag on the preview to frame your image, or enter an exact crop.",
  ],
  [
    "transform",
    "↻",
    "Rotate & flip",
    "A fresh point of view.",
    "Turn things around, or see the other side.",
  ],
  [
    "adjust",
    "☷",
    "Adjust colors",
    "Set the right mood.",
    "Fine-tune brightness, contrast, saturation, and grayscale.",
  ],
  [
    "watermark",
    "✎",
    "Watermark",
    "Make your mark.",
    "Add a text signature before sharing your work.",
  ],
  [
    "metadata",
    "◈",
    "Remove metadata",
    "Share the image. Keep the details.",
    "Remove embedded camera, location, and other source metadata.",
  ],
];
let tool = "convert",
  items = [],
  selected = null,
  busy = false,
  previewUrl = null,
  version = 0,
  timer;
const defaults = () => ({
  format: "webp",
  quality: 82,
  rotation: 0,
  flipX: false,
  flipY: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  watermark: "",
  watermarkSize: 4,
  watermarkColor: "#ffffff",
  opacity: 65,
  background: "#ffffff",
  upscale: false,
});
let settings = defaults();
const current = () => items.find((i) => i.id === selected);
function notify(message) {
  $("message").textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => ($("message").textContent = ""), 6500);
}
$("tools").innerHTML = tools
  .map(
    ([id, icon, name]) =>
      `<button data-tool="${id}" class="${id === tool ? "active" : ""}"><span class="icon">${icon}</span>${name}</button>`,
  )
  .join("");
$("tools").onclick = (e) => {
  const button = e.target.closest("[data-tool]");
  if (!button) return;
  tool = button.dataset.tool;
  updateTool();
};
function field(label, content, hint = "") {
  return `<div class="field"><label>${label}</label>${content}${hint ? `<p>${hint}</p>` : ""}</div>`;
}
function number(id, label, value, min = 1, max = 40000) {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" min="${min}" max="${max}" value="${Math.round(value)}"></div>`;
}
function range(id, label, value, min, max) {
  return `<div class="field"><label for="${id}">${label}<output id="${id}Value">${value}%</output></label><input id="${id}" type="range" min="${min}" max="${max}" value="${value}"></div>`;
}
function updateTool() {
  const t = tools.find((t) => t[0] === tool);
  $("crumb").textContent = t[2];
  $("title").textContent = t[3];
  $("subtitle").textContent = t[4];
  document.querySelectorAll("[data-tool]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tool === tool);
    b.setAttribute("aria-pressed", b.dataset.tool === tool);
  });
  $("stage").style.cursor = tool === "crop" ? "crosshair" : "default";
  $("cropOverlay").hidden = true;
  controls();
  schedule();
}
function controls() {
  const item = current(),
    w = item?.width || 1920,
    h = item?.height || 1080,
    c = item?.crop || { x: 0, y: 0, width: w, height: h };
  let html = "";
  $("panelTitle").textContent = {
    convert: "Export settings",
    compress: "Compression",
    resize: "Image dimensions",
    crop: "Crop selection",
    transform: "Orientation",
    adjust: "Color adjustments",
    watermark: "Your signature",
    metadata: "Privacy settings",
  }[tool];
  if (tool === "convert" || tool === "compress") {
    html += field(
      "Output format",
      `<div class="segmented">${["webp", "jpg", "png"].map((f) => `<button data-format="${f}" class="${settings.format === f ? "selected" : ""}">${f.toUpperCase()}</button>`).join("")}</div>`,
      settings.format === "png"
        ? "Lossless output with transparency. Quality has no effect."
        : settings.format === "webp"
          ? "A compact format with support for transparency."
          : "Widely compatible. Transparent areas use the background color.",
    );
    html +=
      range("quality", "Quality", settings.quality, 1, 100) +
      '<div class="range-labels"><span>Smaller file</span><span>More detail</span></div>';
    if (settings.format === "jpg")
      html += field(
        "Background color",
        '<input aria-label="Background color" id="background" type="color" value="' +
          settings.background +
          '">',
      );
    html +=
      '<div class="info-box" style="margin-top:24px">' +
      (tool === "compress"
        ? "Try WebP at 70–85% for a smaller file. Some images may grow when re-encoded. Compare the actual output size before downloading."
        : "Transparency is preserved in PNG and WebP. Every export removes the original embedded metadata.") +
      "</div>";
  } else if (tool === "resize") {
    html +=
      '<div class="pair">' +
      number("width", "Max width", item?.outputWidth || w) +
      number("height", "Max height", item?.outputHeight || h) +
      '</div><label class="checkbox"><input id="upscale" type="checkbox" ' +
      (settings.upscale ? "checked" : "") +
      '> Allow enlargement</label><p class="hint">Fits within both limits while preserving aspect ratio. Crop first if you need a different shape.</p>';
    html += field(
      "Quick sizes",
      '<div class="segmented"><button data-size="1920">1920 px</button><button data-size="1080">1080 px</button><button data-size="800">800 px</button></div>',
    );
  } else if (tool === "crop") {
    html += field(
      "Aspect ratio",
      '<select id="ratio" aria-label="Crop aspect ratio"><option value="free">Free selection</option><option value="1">Square 1:1</option><option value="1.7777777778">Landscape 16:9</option><option value="0.8">Portrait 4:5</option><option value="0.6666666667">Portrait 2:3</option></select>',
    );
    html +=
      '<div class="pair">' +
      number("cropX", "Left", c.x, 0, w - 1) +
      number("cropY", "Top", c.y, 0, h - 1) +
      number("cropWidth", "Width", c.width, 1, w) +
      number("cropHeight", "Height", c.height, 1, h) +
      '</div><button id="fullCrop" class="secondary">Use full image</button><p class="hint">Coordinates refer to the original image. Preview shows your current crop. Reset to the full image before drawing another selection.</p>';
  } else if (tool === "transform")
    html +=
      field(
        "Rotate",
        '<div class="segmented"><button data-turn="-90">↶ Left</button><button data-turn="90">Right ↷</button></div>',
      ) +
      field(
        "Mirror",
        '<div class="segmented"><button id="flipX" class="' +
          (settings.flipX ? "selected" : "") +
          '">↔ Horizontal</button><button id="flipY" class="' +
          (settings.flipY ? "selected" : "") +
          '">↕ Vertical</button></div>',
      ) +
      '<p class="hint">Rotation: ' +
      settings.rotation +
      "°. Applied to every image in the tray.</p>";
  else if (tool === "adjust")
    html +=
      range("brightness", "Brightness", settings.brightness, 0, 200) +
      range("contrast", "Contrast", settings.contrast, 0, 200) +
      range("saturation", "Saturation", settings.saturation, 0, 200) +
      range("grayscale", "Grayscale", settings.grayscale, 0, 100);
  else if (tool === "watermark")
    html +=
      field(
        "Text",
        '<input id="watermark" type="text" maxlength="120" placeholder="© Your name" aria-label="Watermark text">',
      ) +
      range("watermarkSize", "Text size", settings.watermarkSize, 1, 15) +
      range("opacity", "Opacity", settings.opacity, 1, 100) +
      field(
        "Text color",
        '<input id="watermarkColor" type="color" aria-label="Watermark color" value="' +
          settings.watermarkColor +
          '">',
      ) +
      '<p class="hint">Placed in the lower right corner. Size scales with the output width.</p>';
  else
    html +=
      '<div class="info-box">◈ &nbsp; Source metadata is removed from every export, including camera details, GPS location, comments, and original embedded profiles.</div><p class="hint">The image is decoded and re-encoded. This is not a lossless metadata-only operation. For lossless pixel output, choose PNG in Convert images.</p><button id="metadataPng" class="secondary">Use PNG for lossless pixels</button>';
  $("controls").innerHTML = html;
  if ($("watermark")) $("watermark").value = settings.watermark;
  if ($("quality")) $("quality").disabled = settings.format === "png";
  $("controls").oninput = (e) => {
    const id = e.target.id;
    if (["width", "height"].includes(id)) {
      if (item) {
        item[id === "width" ? "outputWidth" : "outputHeight"] = clamp(
          e.target.value,
          1,
          40000,
        );
      }
    } else if (id.startsWith("crop")) {
      if (item) {
        const key = {
          cropX: "x",
          cropY: "y",
          cropWidth: "width",
          cropHeight: "height",
        }[id];
        item.crop[key] = clamp(
          e.target.value,
          key === "x" || key === "y" ? 0 : 1,
          key === "x" || key === "width" ? w : h,
        );
        item.crop.x = Math.min(item.crop.x, w - 1);
        item.crop.y = Math.min(item.crop.y, h - 1);
        item.crop.width = Math.min(item.crop.width, w - item.crop.x);
        item.crop.height = Math.min(item.crop.height, h - item.crop.y);
      }
    } else if (id in settings) {
      settings[id] =
        e.target.type === "checkbox"
          ? e.target.checked
          : ["watermark", "background", "watermarkColor"].includes(id)
            ? e.target.value
            : Number(e.target.value);
      if ($(id + "Value")) $(id + "Value").textContent = settings[id] + "%";
    }
    schedule();
  };
  $("controls").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.format) {
      settings.format = b.dataset.format;
      controls();
    }
    if (b.dataset.turn) {
      settings.rotation =
        (settings.rotation + Number(b.dataset.turn) + 360) % 360;
      controls();
    }
    if (b.id === "flipX" || b.id === "flipY") {
      settings[b.id] = !settings[b.id];
      controls();
    }
    if (b.dataset.size && item) {
      item.outputWidth = item.outputHeight = Number(b.dataset.size);
      controls();
    }
    if (b.id === "fullCrop" && item) {
      item.crop = { x: 0, y: 0, width: w, height: h };
      controls();
    }
    if (b.id === "metadataPng") {
      settings.format = "png";
      notify("PNG selected. Export to remove source metadata.");
    }
    schedule();
  };
  if ($("ratio"))
    $("ratio").onchange = (e) => {
      if (!item || e.target.value === "free") return;
      const ratio = Number(e.target.value),
        cw = Math.min(w, h * ratio),
        ch = cw / ratio;
      item.crop = {
        x: Math.round((w - cw) / 2),
        y: Math.round((h - ch) / 2),
        width: Math.round(cw),
        height: Math.round(ch),
      };
      controls();
      schedule();
    };
}
let renderTimer;
function schedule() {
  clearTimeout(renderTimer);
  version++;
  renderTimer = setTimeout(preview, 90);
}
function options(item) {
  return {
    ...settings,
    crop: item.crop,
    width: item.outputWidth,
    height: item.outputHeight,
  };
}
async function preview() {
  const item = current(),
    v = version;
  $("export").disabled = !item || busy;
  $("batch").disabled = !items.length || busy;
  $("compare").disabled = !item;
  $("empty").hidden = !!item;
  $("preview").hidden = !item;
  $("previewTag").hidden = !item;
  if (!item) return;
  try {
    const canvas = renderImage(item.image, options(item));
    const ctx = $("preview").getContext("2d");
    $("preview").width = canvas.width;
    $("preview").height = canvas.height;
    ctx.drawImage(canvas, 0, 0);
    $("imageLabel").textContent = item.file.name;
    $("imageStats").textContent =
      `${item.width} × ${item.height} · ${bytes(item.file.size)}`;
    $("summarySize").textContent = bytes(item.file.size);
    $("outputStats").textContent = "Encoding preview…";
    const blob = await encode(canvas, settings.format, settings.quality);
    if (v !== version) return;
    item.lastBlob = blob;
    const change = Math.round((1 - blob.size / item.file.size) * 100);
    $("outputStats").textContent =
      `${canvas.width} × ${canvas.height} · ${bytes(blob.size)} · ${change >= 0 ? change + "% smaller" : Math.abs(change) + "% larger"}`;
  } catch (error) {
    $("outputStats").textContent = "Preview unavailable";
    notify(error.message);
  }
}
function tray() {
  $("count").textContent = items.length;
  $("queue").replaceChildren();
  if (!items.length) {
    $("queue").innerHTML =
      "<p>Your images will appear here. Add a few to work in batches.</p>";
    return;
  }
  for (const item of items) {
    const b = document.createElement("button");
    b.className = "thumb" + (selected === item.id ? " active" : "");
    b.title = item.file.name;
    b.setAttribute("aria-pressed", selected === item.id);
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "";
    const name = document.createElement("span");
    name.textContent = item.file.name;
    b.append(img, name);
    b.onclick = () => {
      selected = item.id;
      tray();
      controls();
      schedule();
    };
    $("queue").append(b);
  }
}
async function load(files) {
  let failed = 0;
  for (const file of Array.from(files)) {
    if (items.length >= 25) {
      notify("The tray holds 25 images. Clear it to start another batch.");
      break;
    }
    if (file.size > 30 * 1024 * 1024) {
      failed++;
      continue;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Unsupported image"));
        img.src = url;
      });
      if (image.naturalWidth * image.naturalHeight > 40000000)
        throw new Error("Image too large");
      const width = image.naturalWidth,
        height = image.naturalHeight;
      items.push({
        id: crypto.randomUUID(),
        file,
        url,
        image,
        width,
        height,
        crop: { x: 0, y: 0, width, height },
        outputWidth: width,
        outputHeight: height,
      });
      selected = items.at(-1).id;
    } catch {
      URL.revokeObjectURL(url);
      failed++;
    }
  }
  tray();
  controls();
  schedule();
  if (failed)
    notify(
      `${failed} file(s) could not be opened. Use a browser-supported image under 30 MB and 40 MP.`,
    );
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function exportImages(all) {
  if (busy) return;
  busy = true;
  const list = all ? [...items] : [current()].filter(Boolean);
  $("export").disabled = $("batch").disabled = true;
  let success = 0;
  try {
    for (const item of list) {
      $("batch").textContent = `Exporting ${success + 1} of ${list.length}…`;
      const canvas = renderImage(item.image, options(item));
      const blob = await encode(canvas, settings.format, settings.quality);
      download(blob, fileName(item.file.name, settings.format));
      success++;
      await new Promise((r) => setTimeout(r, 180));
    }
    notify(
      `${success} image${success === 1 ? "" : "s"} exported. Check your browser’s downloads.`,
    );
  } catch (error) {
    notify(`Export stopped after ${success} image(s). ${error.message}`);
  } finally {
    busy = false;
    $("batch").textContent = "Export all images";
    schedule();
  }
}
$("export").onclick = () => exportImages(false);
$("batch").onclick = () => exportImages(true);
for (const id of ["browse", "add"])
  $(id).onclick = () => $("fileInput").click();
$("fileInput").onchange = async (e) => {
  await load(e.target.files);
  e.target.value = "";
};
const stage = $("stage");
for (const event of ["dragenter", "dragover"])
  stage.addEventListener(event, (e) => {
    e.preventDefault();
    stage.classList.add("dragging");
  });
stage.addEventListener("dragleave", () => stage.classList.remove("dragging"));
stage.addEventListener("drop", (e) => {
  e.preventDefault();
  stage.classList.remove("dragging");
  load(e.dataTransfer.files);
});
$("clear").onclick = () => {
  if (busy) return;
  for (const item of items) URL.revokeObjectURL(item.url);
  items = [];
  selected = null;
  tray();
  controls();
  schedule();
  $("imageLabel").textContent = "Your canvas awaits";
  $("imageStats").textContent = "A fresh perspective is one image away.";
  $("outputStats").textContent = "100% local";
  $("summarySize").textContent = "—";
};
$("reset").onclick = () => {
  settings = defaults();
  for (const item of items) {
    item.crop = { x: 0, y: 0, width: item.width, height: item.height };
    item.outputWidth = item.width;
    item.outputHeight = item.height;
  }
  controls();
  schedule();
  notify("All adjustments reset. Original images are untouched.");
};
$("fit").onclick = () => {
  schedule();
  notify("Preview fitted to the workspace.");
};
$("compare").onpointerdown = (e) => {
  const item = current();
  if (!item) return;
  e.target.setPointerCapture(e.pointerId);
  const c = $("preview");
  c.width = item.width;
  c.height = item.height;
  c.getContext("2d").drawImage(item.image, 0, 0);
  $("previewTag").textContent = "Original image";
};
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("compare").addEventListener(event, () => {
    $("previewTag").textContent = "Edited preview";
    schedule();
  });
$("compare").onkeydown = (e) => {
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    const item = current();
    if (!item) return;
    const c = $("preview");
    c.width = item.width;
    c.height = item.height;
    c.getContext("2d").drawImage(item.image, 0, 0);
    $("previewTag").textContent = "Original image";
  }
};
$("compare").onkeyup = () => {
  $("previewTag").textContent = "Edited preview";
  schedule();
};
let drag = null;
stage.onpointerdown = (e) => {
  if (tool !== "crop" || !current() || e.target !== $("preview")) return;
  const rect = $("preview").getBoundingClientRect();
  drag = { x: e.clientX, y: e.clientY, rect, crop: { ...current().crop } };
  stage.setPointerCapture(e.pointerId);
};
stage.onpointermove = (e) => {
  if (!drag) return;
  const area = stage.getBoundingClientRect(),
    r = drag.rect,
    x = clamp(e.clientX, r.left, r.right),
    y = clamp(e.clientY, r.top, r.bottom),
    o = $("cropOverlay");
  o.hidden = false;
  o.style.left = Math.min(drag.x, x) - area.left + "px";
  o.style.top = Math.min(drag.y, y) - area.top + "px";
  o.style.width = Math.abs(drag.x - x) + "px";
  o.style.height = Math.abs(drag.y - y) + "px";
};
stage.onpointerup = (e) => {
  if (!drag) return;
  const item = current(),
    r = drag.rect,
    x = clamp(e.clientX, r.left, r.right),
    y = clamp(e.clientY, r.top, r.bottom);
  if (Math.abs(x - drag.x) > 4 && Math.abs(y - drag.y) > 4) {
    if (settings.rotation || settings.flipX || settings.flipY) {
      notify(
        "Reset rotation and flips before drawing a crop. Numeric crop fields remain available.",
      );
    } else {
      const c = drag.crop;
      item.crop = {
        x: Math.round(
          c.x + ((Math.min(x, drag.x) - r.left) / r.width) * c.width,
        ),
        y: Math.round(
          c.y + ((Math.min(y, drag.y) - r.top) / r.height) * c.height,
        ),
        width: Math.max(
          1,
          Math.round((Math.abs(x - drag.x) / r.width) * c.width),
        ),
        height: Math.max(
          1,
          Math.round((Math.abs(y - drag.y) / r.height) * c.height),
        ),
      };
      controls();
      schedule();
    }
  }
  drag = null;
  $("cropOverlay").hidden = true;
};
stage.onpointercancel = () => {
  drag = null;
  $("cropOverlay").hidden = true;
};
$("helpButton").onclick = () => $("help").showModal();
for (const id of ["closeHelp", "helpDone"])
  $(id).onclick = () => $("help").close();
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
    e.preventDefault();
    $("fileInput").click();
  }
});
$("demo").onclick = () => {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1100;
  const x = c.getContext("2d");
  x.fillStyle = "#a9c7de";
  x.fillRect(0, 0, 1600, 1100);
  const g = x.createLinearGradient(0, 0, 0, 1100);
  g.addColorStop(0, "#adcbdc");
  g.addColorStop(1, "#e3dad0");
  x.fillStyle = g;
  x.fillRect(0, 0, 1600, 1100);
  x.fillStyle = "#fae5b2";
  x.beginPath();
  x.arc(1150, 280, 105, 0, Math.PI * 2);
  x.fill();
  for (const [color, points] of [
    [
      "#7c99a5",
      [
        [0, 850],
        [470, 310],
        [850, 850],
      ],
    ],
    [
      "#577886",
      [
        [400, 950],
        [1000, 370],
        [1600, 950],
      ],
    ],
    [
      "#345a69",
      [
        [750, 1100],
        [1450, 480],
        [1800, 1100],
      ],
    ],
    [
      "#244755",
      [
        [0, 1100],
        [380, 760],
        [950, 1100],
      ],
    ],
  ]) {
    x.fillStyle = color;
    x.beginPath();
    points.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.closePath();
    x.fill();
  }
  c.toBlob(
    (blob) =>
      load([new File([blob], "mountain-study.png", { type: "image/png" })]),
    "image/png",
  );
};
updateTool();
