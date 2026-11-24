# Homunculus Mirror

A camera mirror that redraws you as the **sensory homunculus**: the map of the body as the brain feels it, with oversized hands, lips and face.

**Try it:** https://mirror.valemasnita.com

Part of the work of [Valentina Mașniță](https://valemasnita.com), about the body in direct contact with machines.

## How it works

- **Tracking:** [MediaPipe](https://ai.google.dev/edge/mediapipe) hand and face landmark models find both hands, the lips and the face in each camera frame.
- **Warp:** a WebGL fragment shader magnifies each area with a smooth radial bulge. Hands and lips grow the most, the face less, in proportion to how much of the brain's touch map they take up.
- **Shrinking:** body tracking (MediaPipe Pose) finds the shoulders and torso, which shrink, so the contrast with the oversized parts reads as a homunculus rather than a fisheye.
- **Labels:** callouts follow each body part with its approximate share of the brain's touch or movement map (rough estimates after Penfield, 1950).
- **Contact:** a fingertip touching the face or the other hand flares and swells at the point of contact.
- **Modes:** Touch (sensory map), Movement (motor map), and Scanner, a slow sweeping bar that only updates the strip under it, like a handheld book scanner.
- **Trails, Photo, Record:** feedback trails, still images, and up to 10-second clips, all saved only on the device.
- **Smoothing:** a One Euro filter on every tracked part keeps the warp steady when still and responsive when moving.
- **Privacy:** everything runs in the browser on the visitor's device. The models and WebAssembly files are served from this site; no video leaves the device.

Built with React, TypeScript and Vite. Hosted on Cloudflare Workers (static assets).

## Run locally

```sh
npm install
npm run dev
```

`npm run build` copies MediaPipe's WebAssembly files into `public/wasm`, type-checks, and builds to `dist/`.
