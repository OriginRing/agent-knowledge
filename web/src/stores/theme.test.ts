// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import httpClient from "@view/services/http";
import { useThemeStore } from "./theme";

vi.mock("@view/services/http", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("theme store backgrounds", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads background images from the API and resolves the selected URL", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      code: 0,
      message: "success",
      data: [
        {
          id: 7,
          name: "星空",
          url: "/bg-images/star.jpg",
          userId: null,
          push: true,
          promotionText: "试试新的星空背景",
        },
      ],
    });
    const store = useThemeStore();

    await store.loadBackgroundImages();
    store.setBackgroundImage("7");

    expect(httpClient.get).toHaveBeenCalledWith("/auth/background-images");
    expect(store.backgroundImages[0].id).toBe("7");
    expect(store.backgroundImageUrl).toBe("/bg-images/star.jpg");
    expect(localStorage.getItem("backgroundImage")).toBe("7");
    expect(store.pushedBackground?.id).toBe("7");
  });

  it("clears a saved selection that is no longer returned", async () => {
    localStorage.setItem("backgroundImage", "99");
    vi.mocked(httpClient.get).mockResolvedValue({
      code: 0,
      message: "success",
      data: [],
    });
    const store = useThemeStore();

    await store.loadBackgroundImages();

    expect(store.backgroundImageId).toBe("");
    expect(localStorage.getItem("backgroundImage")).toBeNull();
  });

  it("shows each pushed background only once per browser session", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      code: 0,
      message: "success",
      data: [
        {
          id: 8,
          name: "雪夜",
          url: "/bg-images/snow.jpg",
          userId: null,
          push: true,
          promotionText: null,
        },
      ],
    });
    const store = useThemeStore();

    await store.loadBackgroundImages();
    store.dismissPushedBackground();
    await store.loadBackgroundImages();

    expect(store.pushedBackground).toBeNull();
    expect(sessionStorage.getItem("backgroundPushSeen:8")).toBe("1");
  });
});
