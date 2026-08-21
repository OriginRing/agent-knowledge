type ScrollMetrics = Pick<
  HTMLElement,
  "scrollHeight" | "scrollTop" | "clientHeight"
>;

export const isChatScrolledToBottom = (metrics: ScrollMetrics, threshold = 1) =>
  metrics.scrollHeight - Math.abs(metrics.scrollTop) - metrics.clientHeight <=
  threshold;
