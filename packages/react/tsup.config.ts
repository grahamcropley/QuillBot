import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  tsconfig: "./tsconfig.json",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2017",
  external: ["react", "react-dom"],
});
