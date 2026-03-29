import { describe, expect, it } from "vitest";
import {
  MOBILE_SEARCH_PARAM,
  MOBILE_SEARCH_FROM_PARAM,
  buildOpenSearchHref,
  buildCloseSearchHref,
} from "@/components/mobile/mobile-navigation-state";

function toUrl(href: string) {
  return new URL(href, "https://example.test");
}

describe("mobile-navigation-state", () => {
  it("builds search-open href and stores current route as from context", () => {
    const href = buildOpenSearchHref({ pathname: "/doc/abc-123" });
    const url = toUrl(href);

    expect(url.pathname).toBe("/doc/abc-123");
    expect(url.searchParams.get(MOBILE_SEARCH_PARAM)).toBe("1");
    expect(url.searchParams.get(MOBILE_SEARCH_FROM_PARAM)).toBe("/doc/abc-123");
  });

  it("builds search-open href from existing from context", () => {
    const href = buildOpenSearchHref({
      pathname: "/doc/live",
      searchParams: new URLSearchParams("foo=bar&mobileSearch=1&from=%2Fdoc%2Foriginal"),
    });
    const url = toUrl(href);

    expect(url.pathname).toBe("/doc/live");
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get(MOBILE_SEARCH_PARAM)).toBe("1");
    expect(url.searchParams.get(MOBILE_SEARCH_FROM_PARAM)).toBe("/doc/original");
  });

  it("ignores stale from when opening search outside active mobile search mode", () => {
    const href = buildOpenSearchHref({
      pathname: "/doc/live",
      searchParams: new URLSearchParams("foo=bar&from=%2Fdoc%2Fstale"),
    });
    const url = toUrl(href);

    expect(url.pathname).toBe("/doc/live");
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get(MOBILE_SEARCH_PARAM)).toBe("1");
    expect(url.searchParams.get(MOBILE_SEARCH_FROM_PARAM)).toBe("/doc/live");
  });

  it("rejects protocol-relative from path and falls back to current route", () => {
    const href = buildCloseSearchHref({
      pathname: "/doc/live",
      searchParams: new URLSearchParams("mobileSearch=1&from=%2F%2Fevil.com&foo=bar"),
    });
    const url = toUrl(href);

    expect(url.pathname).toBe("/doc/live");
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get(MOBILE_SEARCH_PARAM)).toBeNull();
    expect(url.searchParams.get(MOBILE_SEARCH_FROM_PARAM)).toBeNull();
  });

  it("builds search-close href to from context and strips control params", () => {
    const href = buildCloseSearchHref({
      pathname: "/doc/live",
      searchParams: new URLSearchParams("mobileSearch=1&from=%2Fdoc%2Foriginal&foo=bar"),
    });
    const url = toUrl(href);

    expect(url.pathname).toBe("/doc/original");
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get(MOBILE_SEARCH_PARAM)).toBeNull();
    expect(url.searchParams.get(MOBILE_SEARCH_FROM_PARAM)).toBeNull();
  });

  it("falls back to current pathname when from context is absent", () => {
    const href = buildCloseSearchHref({
      pathname: "/doc/live",
      searchParams: new URLSearchParams("mobileSearch=1"),
    });
    const url = toUrl(href);

    expect(url.pathname).toBe("/doc/live");
    expect(url.searchParams.get(MOBILE_SEARCH_PARAM)).toBeNull();
  });
});
