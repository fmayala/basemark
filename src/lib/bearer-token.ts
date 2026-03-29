export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;

  const match = authorizationHeader.match(/^\s*bearer\s+(.+?)\s*$/i);
  if (!match) return null;

  const token = match[1]?.trim();
  return token ? token : null;
}
