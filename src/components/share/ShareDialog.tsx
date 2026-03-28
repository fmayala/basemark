"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/useIsMobile";
import BottomSheet from "@/components/mobile/BottomSheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Permission {
  id: string;
  documentId: string;
  email: string;
  role: string;
  createdAt: number;
}

interface ShareDialogProps {
  documentId: string;
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
  open: boolean;
  onClose: () => void;
}

export default function ShareDialog({
  documentId,
  isPublic,
  onTogglePublic,
  open,
  onClose,
}: ShareDialogProps) {
  const isMobile = useIsMobile();
  const [localPublic, setLocalPublic] = useState(isPublic);
  useEffect(() => setLocalPublic(isPublic), [isPublic]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Fetch permissions when dialog opens
  useEffect(() => {
    if (!open) return;
    setInviteEmail("");
    setInviteError(null);
    setCopied(false);
    setLoadingPerms(true);
    fetch(`/api/documents/${documentId}/permissions`)
      .then(async (res) => {
        if (res.ok) {
          setPermissions(await res.json());
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPerms(false));
  }, [open, documentId]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${documentId}`
      : "";

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInviteError(data.error ?? "Failed to invite");
        return;
      }
      const perm: Permission = await res.json();
      setPermissions((prev) => [...prev, perm]);
      setInviteEmail("");
    } catch {
      setInviteError("Failed to invite");
    } finally {
      setInviting(false);
    }
  }, [documentId, inviteEmail, inviting]);

  const handleRemovePermission = useCallback(
    async (permId: string) => {
      try {
        await fetch(
          `/api/documents/${documentId}/permissions/${permId}`,
          { method: "DELETE" }
        );
        setPermissions((prev) => prev.filter((p) => p.id !== permId));
      } catch {
        // silently fail
      }
    },
    [documentId]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  // Focus trap & keyboard handling
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;

      const focusable = root.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const innerContent = (
    <>
      {/* Public access section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ui text-text-secondary">
            Public access
          </span>
          <Switch
            checked={localPublic}
            onCheckedChange={(checked) => {
              setLocalPublic(checked);
              onTogglePublic(checked);
            }}
            aria-label="Toggle public access"
          />
        </div>
        {localPublic && (
          <div className="flex gap-2 items-center">
            <Input
              readOnly
              value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              aria-label="Public share link"
              className="flex-1 font-mono text-xs text-text-secondary"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`shrink-0 ${copied ? "text-accent" : ""}`}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <Separator className="mb-5" />

      {/* Invite people section */}
      <div>
        <Label htmlFor="invite-email" className="text-ui text-text-secondary mb-2">
          Invite people
        </Label>
        <div className="flex gap-2 mb-3">
          <Input
            id="invite-email"
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInvite();
            }}
            className="flex-1"
          />
          <Button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="shrink-0"
          >
            {inviting ? "..." : "Invite"}
          </Button>
        </div>
        {inviteError && (
          <p className="m-0 mb-2 text-xs text-danger" role="alert">
            {inviteError}
          </p>
        )}

        {/* Permissions list */}
        {loadingPerms ? (
          <p className="text-xs text-text-faint m-0">Loading...</p>
        ) : permissions.length > 0 ? (
          <ul className="list-none m-0 p-0 space-y-1">
            {permissions.map((perm) => (
              <li
                key={perm.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-bg-hover transition-colors duration-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-ui text-text-primary truncate">
                    {perm.email}
                  </span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {perm.role === "viewer" ? "Viewer" : perm.role}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemovePermission(perm.id)}
                  aria-label={`Remove ${perm.email}`}
                  className="text-text-faint hover:text-text-primary"
                >
                  &times;
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-faint m-0">
            No one has been invited yet.
          </p>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Share document">
        {innerContent}
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlayClick}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="bg-bg-sidebar border border-border-subtle rounded-xl p-6 w-[440px] max-w-[90vw] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          >
            <p id={descriptionId} className="sr-only">
              Share this document publicly or invite specific people.
            </p>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                id={titleId}
                className="m-0 text-mobile-input font-semibold text-text-primary"
              >
                Share document
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close"
                className="text-text-faint hover:text-text-primary"
              >
                &times;
              </Button>
            </div>

            {innerContent}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
