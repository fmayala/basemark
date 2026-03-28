"use client";

import { PanelLeft, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Tab {
  id: string;
  title: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  sidebarOpen: boolean;
  sidebarWidth: number;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onToggleSidebar: () => void;
  onNewTab: () => void;
  onShare?: () => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  sidebarOpen,
  sidebarWidth,
  onTabClick,
  onTabClose,
  onToggleSidebar,
  onNewTab,
  onShare,
}: TabBarProps) {
  return (
    <div className="flex items-end bg-bg-sidebar h-11 shrink-0 overflow-hidden">
      {/* Sidebar zone — toggle at pl-3 aligns icon with search input's px-3 container below */}
      <div
        className="shrink-0 transition-[width] duration-200 ease-in-out flex items-end overflow-hidden"
        style={{ width: sidebarOpen ? sidebarWidth : 36 }}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                onClick={onToggleSidebar}
                className="pl-3 pr-2 h-[36px] text-text-faint hover:text-text-secondary shrink-0"
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              />
            }
          >
            <PanelLeft size={16} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Tabs */}
      <div className="flex items-end flex-1 overflow-hidden pl-[14px]" role="tablist" aria-label="Open documents">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`group tab-enter relative flex items-center gap-1.5 pr-2 pl-2 py-1.5 text-sm font-body whitespace-nowrap max-w-[180px] select-none h-[36px] transition-colors duration-150
                ${isActive
                  ? "tab-active bg-bg-primary rounded-t-xl text-text-primary z-[1]"
                  : "bg-transparent rounded-none text-text-faint z-0 hover:text-text-secondary"
                }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabClick(tab.id)}
                className="min-w-0 flex-1 bg-transparent border-none cursor-pointer text-inherit text-left font-inherit p-1 rounded"
              >
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                  {tab.title || "Untitled"}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                className="w-6 h-6 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-50 group-focus-within:opacity-50 hover:!opacity-100 focus-visible:!opacity-100 hover:bg-bg-hover active:bg-bg-hover transition-all duration-150 text-ui"
                aria-label={`Close ${tab.title || "Untitled"}`}
              >
                ×
              </button>
            </div>
          );
        })}

        {/* New tab button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNewTab}
                className="text-text-faint shrink-0 h-[36px] self-end hover:text-text-secondary"
                aria-label="New document"
              />
            }
          >
            <Plus size={13} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent side="bottom">New document</TooltipContent>
        </Tooltip>
      </div>

      {/* Share button — only shown when a tab is active */}
      {activeTabId !== null && onShare && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onShare}
          className="text-text-faint shrink-0 h-[30px] self-end mb-1.5 mr-3 hover:text-text-secondary gap-1.5"
          aria-label="Share document"
        >
          <Share2 size={13} strokeWidth={1.5} />
          Share
        </Button>
      )}
    </div>
  );
}
