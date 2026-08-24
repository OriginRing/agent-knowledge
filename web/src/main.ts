import "./utils/prism-global";
import { createApp } from "vue";
import Antd from "ant-design-vue";
import AntdX from "ant-design-x-vue";
import "github-markdown-css/github-markdown-light.css";
import darkMarkdownCss from "github-markdown-css/github-markdown-dark.css?raw";
import "ant-design-vue/dist/reset.css";
import "./style.less";
import "./styles/markdown.less";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import dayjs from "dayjs";

// 将暗色主题 CSS 作用域限定到 :root.dark 下
const scopedDarkCss = darkMarkdownCss
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(
    /([^{}@]+)(\{[^{}]*\})/g,
    (_match: string, selectors: string, block: string) => {
      const scoped = selectors
        .split(",")
        .map((s: string) => {
          const trimmed = s.trim();
          if (!trimmed || trimmed.startsWith("@")) return trimmed;
          return `:root.dark ${trimmed}`;
        })
        .join(", ");
      return `${scoped} ${block}`;
    },
  );

const style = document.createElement("style");
style.textContent = scopedDarkCss;
document.head.appendChild(style);

const app = createApp(App);
app.use(createPinia());
app.config.globalProperties.$dayjs = dayjs;
app.use(router);
app.use(AntdX);
app.use(Antd);
app.mount("#app");
