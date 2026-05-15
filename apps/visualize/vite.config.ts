import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "/packages/grib2-decoder/dist/grib2-decoder.js": new URL(
        "../../packages/grib2-decoder/dist/grib2-decoder.js",
        import.meta.url,
      ).pathname,
    },
  },
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
  },
});
