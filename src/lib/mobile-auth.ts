const MOBILE_CALLBACK_SCHEME = "basemark:";
const MOBILE_CALLBACK_HOST = "auth";

export function parseMobileAuthCallback(input: string | null): URL | null {
  if (!input) return null;

  try {
    const url = new URL(input);
    if (url.protocol !== MOBILE_CALLBACK_SCHEME) return null;
    if (url.hostname !== MOBILE_CALLBACK_HOST) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function buildMobileAuthRedirect(callback: URL, params: Record<string, string>): URL {
  const url = new URL(callback.toString());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}
