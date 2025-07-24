import { defineConfig } from "vite";
import monacoEditorPluginCJS from "vite-plugin-monaco-editor";
import react from "@vitejs/plugin-react";
import timestampCJS from "time-stamp";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { visualizer } from "rollup-plugin-visualizer";

//commonJS adaptor shims
const monacoEditorPlugin = (monacoEditorPluginCJS as any).default;
const utc = (timestampCJS as any).utc;

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  const BUILD_STAMP = [
    "hash",
    isProduction ? "prod" : "dev",
    utc("YYYY-MM-DD-THHmm_ssms"),
  ].join("-");

  return {
    root: "src",
    build: {
      // Relative to the root
      outDir: "../dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: "./src/index.html",
          embed: "./src/embed.html",
        },
        output: {
          manualChunks: {
            vendor: [
              "lodash-es",
              "rxjs",
              "@reduxjs/toolkit",
              "immer",
              "uuid",
              "@juggle/resize-observer",
              "@deck.gl/core",
              "@deck.gl/layers",
              "@loaders.gl/core",
              "@luma.gl/core",
            ],
            react: ["react", "react-dom", "react-redux", "recoil"],
            monaco: ["monaco-editor"],
          },
        },
      },
      reportCompressedSize: false,
      minify: true,
      sourcemap: false,
    },
    define: {
      BUILD_STAMP: JSON.stringify(BUILD_STAMP),
    },
    server: {
      port: 8080,
    },
    preview: {
      port: 8080,
      open: true,
    },
    resolve: {
      alias: {
        // Aliases preserved from old webpack config for migration, should investigate removing.
        lodash: "lodash-es",
        "lodash.omit": "lodash-es/omit",
        "lodash.pick": "lodash-es/pick",
        "@juggle/resize-observer$": "empty-module",

        // mapgl bug workaround https://github.com/alex3165/react-mapbox-gl/issues/822#issuecomment-835781698
        "react-mapbox-gl": "react-mapbox-gl/lib",
      },
    },
    worker: {
      plugins: () => [wasm(), topLevelAwait()],
      format: "es",
    },
    plugins: [
      wasm(),
      topLevelAwait(),
      react(),
      monacoEditorPlugin({}),
      isProduction && process.env.ANALYZE && visualizer({
        filename: "../dist/bundle-report.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
  };
});
