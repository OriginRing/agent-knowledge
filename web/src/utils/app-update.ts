import { ref, type Ref } from "vue";

export const APP_VERSION_QUERY_PARAM = "__app_version";

interface VersionManifest {
  version: string;
}

interface AppUpdateCheckerOptions {
  currentVersion: string;
  enabled?: boolean;
  fetcher?: typeof fetch;
  versionUrl?: string;
  windowTarget?: Window;
  documentTarget?: Document;
}

export interface AppUpdateChecker {
  updateAvailable: Ref<boolean>;
  checkForUpdate: () => Promise<void>;
  start: () => void;
  stop: () => void;
  reloadToUpdate: () => void;
}

const isVersionManifest = (value: unknown): value is VersionManifest => {
  if (!value || typeof value !== "object") return false;
  return (
    "version" in value &&
    typeof (value as { version?: unknown }).version === "string" &&
    (value as { version: string }).version.length > 0
  );
};

export const createVersionRequestUrl = (
  versionUrl: string,
  timestamp = Date.now(),
) => {
  const url = new URL(versionUrl, window.location.href);
  url.searchParams.set("_t", String(timestamp));
  return url.toString();
};

export const createReloadUrl = (currentUrl: string, version: string) => {
  const url = new URL(currentUrl);
  url.searchParams.set(APP_VERSION_QUERY_PARAM, version);
  return url.toString();
};

export const clearAppVersionQueryParam = (
  locationTarget: Location = window.location,
  historyTarget: History = window.history,
) => {
  const url = new URL(locationTarget.href);
  if (!url.searchParams.has(APP_VERSION_QUERY_PARAM)) return;

  url.searchParams.delete(APP_VERSION_QUERY_PARAM);
  historyTarget.replaceState(
    historyTarget.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
};

export const createAppUpdateChecker = ({
  currentVersion,
  enabled = true,
  fetcher = window.fetch.bind(window),
  versionUrl = `${import.meta.env.BASE_URL}version.json`,
  windowTarget = window,
  documentTarget = document,
}: AppUpdateCheckerOptions): AppUpdateChecker => {
  const updateAvailable = ref(false);
  let latestVersion = "";
  let pendingCheck: Promise<void> | null = null;
  let started = false;

  const checkForUpdate = () => {
    if (!enabled) return Promise.resolve();
    if (pendingCheck) return pendingCheck;

    pendingCheck = (async () => {
      try {
        const response = await fetcher(createVersionRequestUrl(versionUrl), {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const manifest: unknown = await response.json();
        if (!isVersionManifest(manifest)) return;

        if (manifest.version === currentVersion) return;

        latestVersion = manifest.version;
        updateAvailable.value = true;
      } catch {
        // 更新检测不应影响页面现有功能。
      } finally {
        pendingCheck = null;
      }
    })();

    return pendingCheck;
  };

  const handleVisibilityChange = () => {
    if (documentTarget.visibilityState === "visible") {
      void checkForUpdate();
    }
  };

  const start = () => {
    if (!enabled || started) return;
    started = true;
    windowTarget.addEventListener("focus", checkForUpdate);
    documentTarget.addEventListener("visibilitychange", handleVisibilityChange);
    void checkForUpdate();
  };

  const stop = () => {
    if (!started) return;
    started = false;
    windowTarget.removeEventListener("focus", checkForUpdate);
    documentTarget.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };

  const reloadToUpdate = () => {
    if (!updateAvailable.value || !latestVersion) return;
    windowTarget.location.replace(
      createReloadUrl(windowTarget.location.href, latestVersion),
    );
  };

  return {
    updateAvailable,
    checkForUpdate,
    start,
    stop,
    reloadToUpdate,
  };
};
