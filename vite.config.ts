import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MediaPipe loads its WebAssembly with importScripts, which needs a classic worker.
  worker: { format: "iife" },
});
