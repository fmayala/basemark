export type MobileScreen = "list" | "editor" | "search";

export function deriveMobileScreen(pathname: string, view: string | null): {
  screen: MobileScreen;
  activeDocId: string | null;
} {
  if (view === "search") {
    return { screen: "search", activeDocId: null };
  }

  if (pathname.startsWith("/doc/")) {
    const activeDocId = pathname.slice("/doc/".length).split("/")[0] ?? "";
    if (!activeDocId) {
      return { screen: "list", activeDocId: null };
    }

    return {
      screen: "editor",
      activeDocId,
    };
  }

  return { screen: "list", activeDocId: null };
}
