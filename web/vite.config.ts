import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

const appVersion = process.env.APP_VERSION?.trim() || new Date().toISOString();

const prismComponentsModulePlugin = () => ({
  name: "prism-components-module-scope",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    const moduleId = id.split("?", 1)[0].replaceAll("\\", "/");
    const isPrismComponent = moduleId.includes(
      "/prismjs/components/prism-",
    );
    const isPrismCore = /\/prism-core(?:\.min)?\.js$/.test(moduleId);

    if (!isPrismComponent || isPrismCore) return null;

    return {
      code: `import Prism from "prismjs";\n${code}`,
      map: null,
    };
  },
});

export default defineConfig({
  plugins: [
    prismComponentsModulePlugin(),
    vue(),
    {
      name: "emit-app-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: `${JSON.stringify({ version: appVersion }, null, 2)}\n`,
        });
      },
    },
  ],
  define: {
    "import.meta.env.APP_VERSION": JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@view": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/auth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
      "/file": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
      "/agent": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
