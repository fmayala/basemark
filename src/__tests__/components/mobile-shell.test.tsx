// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MobileShell from "@/components/mobile/MobileShell";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/doc/live",
  useSearchParams: () => new URLSearchParams("mobileSearch=1&from=%2Fdoc%2Foriginal&foo=bar"),
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("@/hooks/useDocuments", () => ({
  useDocuments: () => ({
    documents: [],
    createDocument: vi.fn(),
    deleteDocument: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCollections", () => ({
  useCollections: () => ({
    collections: [],
  }),
}));

vi.mock("@/components/mobile/MobileSearch", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Close Search
    </button>
  ),
}));

vi.mock("@/components/mobile/MobileEditor", () => ({
  default: () => <div>Editor</div>,
}));

vi.mock("@/components/mobile/MobileNotesList", () => ({
  MobileNotesList: () => <div>List</div>,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

describe("MobileShell", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
  });

  it("closes search with router.replace and does not push", () => {
    render(<MobileShell />);

    fireEvent.click(screen.getByRole("button", { name: "Close Search" }));

    expect(replaceMock).toHaveBeenCalledWith("/doc/original?foo=bar");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
