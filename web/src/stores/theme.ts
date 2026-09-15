import { defineStore } from "pinia";
import httpClient from "@view/services/http";

export interface BackgroundImage {
  id: string;
  name: string;
  url: string;
  userId: string | null;
  push: boolean;
  promotionText: string | null;
}

interface BackgroundImageResponse extends Omit<BackgroundImage, "id"> {
  id: number | string;
}

export const useThemeStore = defineStore("theme", {
  state: () => ({
    isDark: localStorage.getItem("darkTheme") === "1",
    backgroundImageId: localStorage.getItem("backgroundImage") ?? "",
    backgroundImages: [] as BackgroundImage[],
    backgroundImagesLoading: false,
    pushedBackground: null as BackgroundImage | null,
  }),
  getters: {
    getToggleDark: (state) => state.isDark,
    backgroundImageUrl: (state) =>
      state.backgroundImages.find(
        (image) => image.id === state.backgroundImageId,
      )?.url ?? "",
  },
  actions: {
    setToggleDark(theme: boolean) {
      this.isDark = theme;
      localStorage.setItem("darkTheme", this.isDark ? "1" : "0");
    },
    setBackgroundImage(imageId: string) {
      this.backgroundImageId = this.backgroundImages.some(
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
    async loadBackgroundImages() {
      this.backgroundImagesLoading = true;
      try {
        const result = await httpClient.get<BackgroundImageResponse[]>(
          "/auth/background-images",
        );
        if (result.code !== 0) throw new Error(result.message);
        this.backgroundImages = result.data.map((image) => ({
          ...image,
          id: String(image.id),
          push: Boolean(image.push),
        }));
        if (!this.pushedBackground) {
          this.pushedBackground =
            [...this.backgroundImages]
              .reverse()
              .find(
                (image) =>
                  image.push &&
                  sessionStorage.getItem(`backgroundPushSeen:${image.id}`) !==
                    "1",
              ) ?? null;
        }
        if (
          this.backgroundImageId &&
          !this.backgroundImages.some(
            (image) => image.id === this.backgroundImageId,
          )
        ) {
          this.setBackgroundImage("");
        }
      } finally {
        this.backgroundImagesLoading = false;
      }
    },
    dismissPushedBackground() {
      if (this.pushedBackground) {
        sessionStorage.setItem(
          `backgroundPushSeen:${this.pushedBackground.id}`,
          "1",
        );
      }
      this.pushedBackground = null;
    },
  },
});
