// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_VERSION_QUERY_PARAM,
  clearAppVersionQueryParam,
  createAppUpdateChecker,
  createReloadUrl,
} from "./app-update";

const jsonResponse = (version: string) =>
  new Response(JSON.stringify({ version }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("createAppUpdateChecker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not show the update button for the current version", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse("current"));
    const checker = createAppUpdateChecker({
      currentVersion: "current",
      fetcher,
    });

    await checker.checkForUpdate();

    expect(checker.updateAvailable.value).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("version.json?_t="),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the update available until the user reloads", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("next"))
      .mockResolvedValueOnce(jsonResponse("current"));
    const checker = createAppUpdateChecker({
      currentVersion: "current",
      fetcher,
    });

    await checker.checkForUpdate();
    await checker.checkForUpdate();

    expect(checker.updateAvailable.value).toBe(true);
  });

  it("deduplicates checks triggered while a request is pending", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const checker = createAppUpdateChecker({
      currentVersion: "current",
      fetcher,
    });

    const firstCheck = checker.checkForUpdate();
    const secondCheck = checker.checkForUpdate();
    resolveResponse(jsonResponse("next"));
    await Promise.all([firstCheck, secondCheck]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(checker.updateAvailable.value).toBe(true);
  });

  it("checks on start, focus, and becoming visible", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse("current"));
    const checker = createAppUpdateChecker({
      currentVersion: "current",
      fetcher,
    });

    checker.start();
    await checker.checkForUpdate();
    expect(fetcher).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await checker.checkForUpdate();
    expect(fetcher).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await checker.checkForUpdate();
    expect(fetcher).toHaveBeenCalledTimes(3);

    checker.stop();
    window.dispatchEvent(new Event("focus"));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("silently ignores request failures", async () => {
    const checker = createAppUpdateChecker({
      currentVersion: "current",
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
    });

    await expect(checker.checkForUpdate()).resolves.toBeUndefined();
    expect(checker.updateAvailable.value).toBe(false);
  });
});

describe("app update reload URL", () => {
  it("preserves route, existing query, and hash", () => {
    const url = new URL(
      createReloadUrl("https://example.com/history?tab=all#latest", "next"),
    );

    expect(url.pathname).toBe("/history");
    expect(url.searchParams.get("tab")).toBe("all");
    expect(url.searchParams.get(APP_VERSION_QUERY_PARAM)).toBe("next");
    expect(url.hash).toBe("#latest");
  });

  it("clears only the internal version query parameter", () => {
    const replaceState = vi.fn();
    const locationTarget = {
      href: "https://example.com/history?tab=all&__app_version=next#latest",
    } as Location;
    const historyTarget = {
      state: { key: "value" },
      replaceState,
    } as unknown as History;

    clearAppVersionQueryParam(locationTarget, historyTarget);

    expect(replaceState).toHaveBeenCalledWith(
      { key: "value" },
      "",
      "/history?tab=all#latest",
    );
  });
});
