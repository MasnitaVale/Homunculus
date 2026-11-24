# Homunculus Mirror — mirror.valemasnita.com

Camera mirror that magnifies hands, lips and face (the sensory homunculus). React + Vite + TypeScript, MediaPipe tracking, WebGL warp. Hosted on Cloudflare Workers (static assets, `wrangler.jsonc`): every push to `main` deploys.

The owner usually edits from their phone through Claude. Keep changes small and explain results in plain words.

- `src/content.ts`: all visible text.
- `src/tracker.ts`: finds hands/lips/face; `WEIGHT` sets how much each grows.
- `src/warp.ts`: WebGL shader that draws the mirrored, magnified image.
- `src/App.tsx`: start screen, camera, controls (strength, photo, stop).
- `public/models/`: MediaPipe model files (served by the site, no third-party requests).

Before committing: run `npm run build`. Check at phone width (~375px). Everything must stay on-device: no uploads, analytics or third-party requests.
