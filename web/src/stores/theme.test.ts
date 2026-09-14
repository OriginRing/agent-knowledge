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
});
