import test from "node:test";
import assert from "node:assert/strict";
import { dimensions, cropBounds, fileName, bytes } from "../dist/engine.js";
test("resize fits both bounds and preserves aspect ratio", () => {
  assert.deepEqual(dimensions(4000, 3000, 1200, 1200), {
    width: 1200,
    height: 900,
  });
  assert.deepEqual(dimensions(3000, 4000, 1200, 1200), {
    width: 900,
    height: 1200,
  });
});
test("enlargement is opt-in", () => {
  assert.deepEqual(dimensions(100, 50, 1000, 1000), { width: 100, height: 50 });
  assert.deepEqual(dimensions(100, 50, 1000, 1000, true), {
    width: 1000,
    height: 500,
  });
});
test("crop cannot read beyond the image", () => {
  assert.deepEqual(
    cropBounds({ x: 999, y: -5, width: 500, height: 500 }, 100, 80),
    { x: 99, y: 0, width: 1, height: 80 },
  );
});
test("tiny resizes never produce a zero-size canvas", () =>
  assert.deepEqual(dimensions(10000, 1, 1, 1), { width: 1, height: 1 }));
test("export names retain multi-dot stems", () =>
  assert.equal(
    fileName("photo.final.jpeg", "webp"),
    "photo.final-edited.webp",
  ));
test("file sizes use readable units", () => {
  assert.equal(bytes(512), "512 B");
  assert.equal(bytes(2048), "2.0 KB");
  assert.equal(bytes(1048576), "1.00 MB");
});

test("rendering combines rotation, resize, background and watermark", async () => {
  const { renderImage } = await import("../dist/engine.js");
  const calls = [];
  const context = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) =>
          calls.push([method, ...args]),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = { getContext: () => context };
  globalThis.document = { createElement: () => canvas };
  try {
    const result = renderImage(
      { width: 1200, height: 800 },
      {
        crop: { x: 100, y: 50, width: 600, height: 400 },
        rotation: 90,
        width: 300,
        height: 300,
        upscale: false,
        format: "jpg",
        background: "#fff",
        flipX: false,
        flipY: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: 0,
        watermark: "Test",
        watermarkSize: 4,
        opacity: 65,
        watermarkColor: "#fff",
      },
    );
    assert.equal(result.width, 200);
    assert.equal(result.height, 300);
    assert.ok(calls.some(([name]) => name === "fillRect"));
    assert.ok(
      calls.some(([name, angle]) => name === "rotate" && angle === Math.PI / 2),
    );
    const drawing = calls.find(([name]) => name === "drawImage");
    assert.deepEqual(drawing.slice(2, 6), [100, 50, 600, 400]);
    assert.ok(
      calls.some(([name, text]) => name === "fillText" && text === "Test"),
    );
  } finally {
    delete globalThis.document;
  }
});
