import { defineStore } from "pinia";

type BackgroundImageModule = Record<string, string>;

const backgroundImageModules = import.meta.glob<BackgroundImageModule>(
  "../assets/bg-images/*.{png,jpg,jpeg,webp,avif,gif}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as unknown as Record<string, string>;

export const backgroundImages = Object.entries(backgroundImageModules)
  .map(([path, url]) => {
    const filename = path.split("/").pop() ?? path;
    return {
      id: filename,
      name: filename.replace(/\.[^.]+$/, ""),
      url,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

export const useThemeStore = defineStore("theme", {
  state: () => ({
    isDark: localStorage.getItem("darkTheme") === "1",
    backgroundImageId: localStorage.getItem("backgroundImage") ?? "",
  }),
  getters: {
    getToggleDark: (state) => state.isDark,
    backgroundImageUrl: (state) =>
      backgroundImages.find((image) => image.id === state.backgroundImageId)
        ?.url ?? "",
  },
  actions: {
    setToggleDark(theme: boolean) {
      this.isDark = theme;
      localStorage.setItem("darkTheme", this.isDark ? "1" : "0");
    },
    setBackgroundImage(imageId: string) {
      this.backgroundImageId = backgroundImages.some(
        (image) => image.id === imageId,
      )
        ? imageId
        : "";

      if (this.backgroundImageId) {
        localStorage.setItem("backgroundImage", this.backgroundImageId);
      } else {
        localStorage.removeItem("backgroundImage");
      }
    },
  },
});
