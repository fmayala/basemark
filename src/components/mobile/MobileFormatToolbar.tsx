"use client";

import { useState, useEffect } from "react";

interface MobileFormatToolbarProps {
  editor: any | null;
}

export default function MobileFormatToolbar({ editor }: MobileFormatToolbarProps) {
  const [bottomOffset, setBottomOffset] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      const viewport = window.visualViewport!;
      const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;
      setBottomOffset(keyboardHeight > 100 ? keyboardHeight : 0);
      setVisible(keyboardHeight > 100);
    };
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  if (!visible || !editor) return null;

  const handleHeading = () => {
    if (editor.isActive("heading", { level: 1 })) {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    } else if (editor.isActive("heading", { level: 2 })) {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    } else if (editor.isActive("heading", { level: 3 })) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    }
  };

  const btnBase = "w-11 h-11 flex items-center justify-center rounded text-sm flex-shrink-0";
  const active = "bg-accent/15 text-accent";
  const inactive = "text-text-faint";

  const buttons: {
    label: string;
    onPress: () => void;
    isActive: () => boolean;
    fontStyle?: string;
  }[] = [
    {
      label: "B",
      onPress: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
      fontStyle: "font-bold",
    },
    {
      label: "I",
      onPress: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
      fontStyle: "italic",
    },
    {
      label: "H",
      onPress: handleHeading,
      isActive: () =>
        editor.isActive("heading", { level: 1 }) ||
        editor.isActive("heading", { level: 2 }) ||
        editor.isActive("heading", { level: 3 }),
      fontStyle: "font-semibold",
    },
    {
      label: "<>",
      onPress: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
      fontStyle: "font-mono text-ui",
    },
    {
      label: "•",
      onPress: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive("bulletList"),
      fontStyle: "text-lg",
    },
    {
      label: "☐",
      onPress: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive("taskList"),
    },
    {
      label: "\u201c",
      onPress: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive("blockquote"),
      fontStyle: "text-lg",
    },
    {
      label: "—",
      onPress: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
    },
  ];

  return (
    <div
      style={{ position: "fixed", bottom: bottomOffset, left: 0, right: 0 }}
      className="h-11 bg-bg-sidebar border-t border-border/30 z-[500]"
    >
      <div className="flex items-center gap-1 px-2 h-full overflow-x-auto scrollbar-hide">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onMouseDown={(e) => {
              e.preventDefault();
              btn.onPress();
            }}
            className={`${btnBase} ${btn.isActive() ? active : inactive} ${btn.fontStyle ?? ""}`}
            aria-label={btn.label}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
