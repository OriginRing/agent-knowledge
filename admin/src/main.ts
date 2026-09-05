import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import App from "./App.vue";
import KnowledgePage from "./components/KnowledgePage.vue";
import ModelPage from "./components/ModelPage.vue";
import ResourcePage from "./components/ResourcePage.vue";
import "./style.css";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/knowledge", component: KnowledgePage },
    { path: "/models", component: ModelPage },
    { path: "/", redirect: "/agents" },
    { path: "/:kind(agents|workflows|skills)/:id?", component: ResourcePage },
    { path: "/:pathMatch(.*)*", redirect: "/agents" },
  ],
});
createApp(App).use(createPinia()).use(router).use(Antd).mount("#app");
