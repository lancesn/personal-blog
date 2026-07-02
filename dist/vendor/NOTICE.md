Vendored third-party browser script used only by the article share-card
feature. Loaded on demand, only when a visitor generates a share image.

- `qrcode.min.js` — bundled from `qrcode` v1.5.4 (MIT license) using
  esbuild, exposing a `window.QRCode` global with `toDataURL`/`toCanvas`.
  https://github.com/soldair/node-qrcode
