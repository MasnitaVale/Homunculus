// Copies MediaPipe's WebAssembly files from node_modules into public/wasm,
// so the app serves everything itself (no third-party requests at runtime).
import fs from "node:fs";
import path from "node:path";

const from = path.join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = path.join("public", "wasm");
fs.mkdirSync(to, { recursive: true });
for (const file of fs.readdirSync(from)) fs.copyFileSync(path.join(from, file), path.join(to, file));
console.log(`Copied ${fs.readdirSync(to).length} wasm files to ${to}`);
