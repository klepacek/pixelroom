# Pixelroom

A small, private image workspace. Convert, compress, crop, resize, rotate, adjust colors, add a text watermark, and remove embedded metadata without uploading images to a server.

## Run locally

Requires Node.js 20+ and Python 3. No packages to install.

```sh
npm run dev
```

Open http://localhost:3000. Serve the files over HTTP; opening `index.html` directly will not load the JavaScript modules.

```sh
npm run check
npm test
```

## Working with images

Add up to 25 files, then select an image in the tray. Format, quality, orientation, color adjustments, and watermark settings apply to the entire batch. Crop and resize settings belong to each image. All adjustments are applied together on export.

- Export WebP, JPEG, and PNG. The app checks the encoder's returned MIME type rather than silently downloading a different format.
- Resize fits the image inside the requested width and height, preserving its aspect ratio. Enlargement is off by default.
- Crop by drawing over the preview or entering source-image coordinates. Drawing requires rotation and flips to be reset. Aspect-ratio presets create a centered crop.
- Hold Compare to see the original. Reset restores all images and settings.
- Export all downloads files sequentially. Your browser may require permission for multiple downloads.

Images stay in browser memory. There are no analytics, cookies, accounts, remote fonts, or upload endpoints. Downloads are newly encoded images, so source EXIF, GPS, comments, and embedded profiles do not carry over. The browser may add its own basic encoding information.

## Limits

Input decoding depends on the browser. JPEG, PNG, WebP, GIF, BMP, SVG, and AVIF generally work in current browsers; HEIC and camera RAW are not supported. SVG is rasterized. Animated formats export as a still frame. This is an 8-bit canvas workflow, not a color-managed or archival editor; original profiles, HDR data, animation, and source compression are not preserved.

Files are limited to 30 MB and 40 megapixels each. Large batches can still use significant device memory. PNG is lossless after decoding, but quality settings do not compress PNG. Re-encoding can produce a larger file; the preview reports the actual result. Metadata removal is implemented through re-encoding rather than byte-preserving EXIF editing.

## Project layout

`dist/` contains the deployable app, with no build step. `engine.js` handles geometry, rendering, and encoding. `app.js` handles the workspace, file lifecycle, and downloads. `tests/` covers geometry and filename behavior with Node's built-in runner.

To deploy, serve `dist/` on any static host. No environment variables or backend services are needed.
