export function createRandomSession(len = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let session = "";
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    session += chars[idx];
  }
  return session;
}

export function createChatSession(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = createRandomSession(16);
  return `${timestamp}_${randomStr}`;
}
