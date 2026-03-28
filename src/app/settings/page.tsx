"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

interface NewTokenResult {
  id: string;
  token: string;
  name: string;
  createdAt: number;
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "Never";
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const MCP_URL = "https://basemark.wiki/api/mcp/sse";

const exampleConfig = (token: string) =>
  JSON.stringify(
    {
      mcpServers: {
        basemark: {
          type: "sse",
          url: MCP_URL,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  );

export default function SettingsPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<NewTokenResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) throw new Error(`Failed to load tokens (${res.status})`);
      const data = (await res.json()) as ApiToken[];
      setTokens(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load tokens");
    }
  }, []);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    setNewToken(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error(`Failed to create token (${res.status})`);
      const data = (await res.json()) as NewTokenResult;
      setNewToken(data);
      setNewName("");
      await fetchTokens();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to revoke token (${res.status})`);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (newToken?.id === id) setNewToken(null);
    } catch (err) {
      console.error(err);
    } finally {
      setRevokingId(null);
    }
  };

  const copyToken = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyConfig = async () => {
    const placeholder = newToken?.token ?? "<your-token>";
    await navigator.clipboard.writeText(exampleConfig(placeholder));
    setConfigCopied(true);
    setTimeout(() => setConfigCopied(false), 2000);
  };

  return (
    <div className="max-w-[860px] mx-auto py-12 px-6">
      {/* Page heading */}
      <h1 className="font-title text-display text-text-primary mb-2">Settings</h1>
      <p className="text-sm text-text-faint mb-10">
        Manage API tokens and integrations for Basemark.
      </p>

      <Separator className="mb-10" />

      {/* ── API Tokens section ──────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-base font-semibold text-text-primary mb-1">API Tokens</h2>
        <p className="text-sm text-text-faint mb-6">
          Tokens allow external tools and scripts to authenticate with the Basemark API.
        </p>

        {/* Create token form */}
        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <Input
            placeholder="Token name (e.g. Claude Code)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-xs"
            disabled={creating}
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? "Creating…" : "Create token"}
          </Button>
        </form>

        {createError && (
          <p className="text-sm text-danger mb-4">{createError}</p>
        )}

        {/* One-time token reveal */}
        {newToken && (
          <div className="mb-6 rounded-lg border border-border-subtle bg-bg-input p-4">
            <p className="text-xs font-medium text-callout-warning mb-2">
              Copy this token now — you won&apos;t see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-bg-code px-3 py-2 text-sm font-mono text-text-primary break-all">
                {newToken.token}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToken}
                className="shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        {/* Token list */}
        {loadError && (
          <p className="text-sm text-danger mb-4">{loadError}</p>
        )}

        {tokens.length === 0 && !loadError ? (
          <p className="text-sm text-text-ghost py-4">No tokens yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-bg-input text-xs font-medium text-text-ghost uppercase tracking-wide">
              <span>Name</span>
              <span className="text-right">Prefix</span>
              <span className="text-right">Created</span>
              <span className="text-right">Last used</span>
            </div>
            <Separator />
            {tokens.map((token, idx) => (
              <div key={token.id}>
                {idx > 0 && <Separator />}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3">
                  <span className="text-sm text-text-primary font-medium truncate">
                    {token.name}
                  </span>
                  <code className="text-xs text-text-secondary font-mono">
                    {token.tokenPrefix}
                  </code>
                  <span className="text-xs text-text-faint text-right">
                    {formatDate(token.createdAt)}
                  </span>
                  <div className="flex items-center gap-3 justify-end">
                    <span className="text-xs text-text-faint">
                      {formatDate(token.lastUsedAt)}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revokingId === token.id}
                      onClick={() => handleRevoke(token.id)}
                    >
                      {revokingId === token.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator className="mb-10" />

      {/* ── MCP connection info ──────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-1">MCP Integration</h2>
        <p className="text-sm text-text-faint mb-6">
          Connect Claude Code (or any MCP-compatible client) to Basemark using the remote SSE endpoint.
        </p>

        {/* Remote URL */}
        <div className="mb-6">
          <p className="text-xs text-text-ghost uppercase tracking-wide font-medium mb-1">
            Remote MCP URL
          </p>
          <code className="block rounded-lg bg-bg-input border border-border px-4 py-3 text-sm font-mono text-text-primary">
            {MCP_URL}
          </code>
        </div>

        {/* Example config */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-text-ghost uppercase tracking-wide font-medium">
              Claude Code config example
            </p>
            <Button variant="outline" size="xs" onClick={copyConfig}>
              {configCopied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <pre className="rounded-lg bg-bg-code border border-border px-4 py-3 text-sm font-mono text-text-primary overflow-x-auto">
            {exampleConfig(newToken?.token ?? "<your-token>")}
          </pre>
          {!newToken && (
            <p className="mt-2 text-xs text-text-ghost">
              Create a token above to see it pre-filled in the config.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
