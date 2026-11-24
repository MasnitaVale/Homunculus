# Homunculus Mirror

A camera mirror that redraws you as the **sensory homunculus**: the map of the body as the brain feels it, with oversized hands, lips and face.

**Try it:** https://mirror.valemasnita.com

Part of the work of [Valentina Mașniță](https://valemasnita.com), about the body in direct contact with machines.

## How it works

- **Tracking:** [MediaPipe](https://ai.google.dev/edge/mediapipe) hand and face landmark models find both hands, the lips and the face in each camera frame.
- **Warp:** a WebGL fragment shader magnifies each area with a smooth radial bulge. Hands and lips grow the most, the face less, in proportion to how much of the brain's touch map they take up.
- **Smoothing:** positions ease toward each new detection, and a part fades out when it leaves the frame, so the effect doesn't jitter.
- **Privacy:** everything runs in the browser on the visitor's device. The models and WebAssembly files are served from this site; no video leaves the device.

Built with React, TypeScript and Vite. Hosted on Cloudflare Workers (static assets).

## Run locally

```sh
npm install
npm run dev
```

`npm run build` copies MediaPipe's WebAssembly files into `public/wasm`, type-checks, and builds to `dist/`.
