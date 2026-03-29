export const MOBILE_SEARCH_PARAM = "mobileSearch";
export const MOBILE_SEARCH_FROM_PARAM = "from";

type SearchParamsLike = Pick<URLSearchParams, "toString">;

interface BuildHrefInput {
  pathname: string;
  searchParams?: SearchParamsLike | null;
}

function cloneSearchParams(searchParams?: SearchParamsLike | null) {
  return new URLSearchParams(searchParams?.toString() ?? "");
}

function toSafeInternalPath(path: string | null) {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
}

export function buildOpenSearchHref({ pathname, searchParams }: BuildHrefInput) {
  const nextParams = cloneSearchParams(searchParams);
  const inMobileSearch = nextParams.get(MOBILE_SEARCH_PARAM) === "1";
  const existingFrom = inMobileSearch
    ? toSafeInternalPath(nextParams.get(MOBILE_SEARCH_FROM_PARAM))
    : null;
  const from = existingFrom ?? pathname;

  nextParams.set(MOBILE_SEARCH_FROM_PARAM, from);
  nextParams.set(MOBILE_SEARCH_PARAM, "1");

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildCloseSearchHref({ pathname, searchParams }: BuildHrefInput) {
  const nextParams = cloneSearchParams(searchParams);
  const from = toSafeInternalPath(nextParams.get(MOBILE_SEARCH_FROM_PARAM));

  nextParams.delete(MOBILE_SEARCH_FROM_PARAM);
  nextParams.delete(MOBILE_SEARCH_PARAM);

  const basePath = from ?? pathname;
  const query = nextParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}
