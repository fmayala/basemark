import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSharingService } from "@/domain/services/sharing-service";

describe("sharing-service", () => {
  const now = 1_700_000_000;
  let documentsRepo: { getDocumentRecordById: ReturnType<typeof vi.fn> };
  let permissionsRepo: { listPermissionsForDocument: ReturnType<typeof vi.fn> };
  let documentsWriteRepo: { updateDocumentRecord: ReturnType<typeof vi.fn> };
  let permissionsWriteRepo: { upsertPermission: ReturnType<typeof vi.fn> };
  let sharesRepo: {
    createShareLinkRecord: ReturnType<typeof vi.fn>;
    getShareLinkByToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    documentsRepo = {
      getDocumentRecordById: vi.fn(),
    };
    permissionsRepo = {
      listPermissionsForDocument: vi.fn(),
    };
    documentsWriteRepo = {
      updateDocumentRecord: vi.fn(),
    };
    permissionsWriteRepo = {
      upsertPermission: vi.fn(),
    };
    sharesRepo = {
      createShareLinkRecord: vi.fn(),
      getShareLinkByToken: vi.fn(),
    };
  });

  it("creates a share link for an existing document", async () => {
    documentsRepo.getDocumentRecordById.mockResolvedValue({ id: "doc-1", isPublic: false });
    sharesRepo.createShareLinkRecord.mockResolvedValue({ token: "token-1" });

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.createShareLink({ documentId: "doc-1" });

    expect(result).toEqual({ ok: true, token: "token-1", url: "/share/token-1" });
    expect(sharesRepo.createShareLinkRecord).toHaveBeenCalledWith({
      id: "share-1",
      documentId: "doc-1",
      token: "token-1",
      expiresAt: null,
      createdAt: now,
    });
  });

  it("rejects invalid expiresAt timestamps", async () => {
    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.createShareLink({
      documentId: "doc-1",
      expiresAt: "not-a-date",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_expires_at" });
  });

  it("returns not_found when share token and doc id miss", async () => {
    sharesRepo.getShareLinkByToken.mockResolvedValue(null);
    documentsRepo.getDocumentRecordById.mockResolvedValue(null);

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.resolveSharedDocument({ token: "missing" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns expired for expired share links", async () => {
    sharesRepo.getShareLinkByToken.mockResolvedValue({
      token: "tok",
      documentId: "doc-1",
      expiresAt: now - 1,
    });

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.resolveSharedDocument({ token: "tok" });

    expect(result).toEqual({ status: "expired" });
  });

  it("returns auth_required for private doc without viewer", async () => {
    sharesRepo.getShareLinkByToken.mockResolvedValue(null);
    documentsRepo.getDocumentRecordById.mockResolvedValue({ id: "doc-1", isPublic: false });

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.resolveSharedDocument({ token: "doc-1" });

    expect(result).toEqual({ status: "auth_required" });
  });

  it("returns ready for owner access", async () => {
    const doc = { id: "doc-1", isPublic: false };
    sharesRepo.getShareLinkByToken.mockResolvedValue(null);
    documentsRepo.getDocumentRecordById.mockResolvedValue(doc);

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => true,
    });

    const result = await service.resolveSharedDocument({
      token: "doc-1",
      viewerEmail: "owner@example.com",
    });

    expect(result).toEqual({ status: "ready", document: doc });
  });

  it("returns denied without matching permission", async () => {
    sharesRepo.getShareLinkByToken.mockResolvedValue(null);
    documentsRepo.getDocumentRecordById.mockResolvedValue({ id: "doc-1", isPublic: false });
    permissionsRepo.listPermissionsForDocument.mockResolvedValue([
      { documentId: "doc-1", email: "other@example.com", role: "viewer" },
    ]);

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.resolveSharedDocument({
      token: "doc-1",
      viewerEmail: "viewer@example.com",
    });

    expect(result).toEqual({ status: "denied" });
  });

  it("returns ready when viewer has explicit permission", async () => {
    const doc = { id: "doc-1", isPublic: false };
    sharesRepo.getShareLinkByToken.mockResolvedValue(null);
    documentsRepo.getDocumentRecordById.mockResolvedValue(doc);
    permissionsRepo.listPermissionsForDocument.mockResolvedValue([
      { documentId: "doc-1", email: "viewer@example.com", role: "viewer" },
    ]);

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "share-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.resolveSharedDocument({
      token: "doc-1",
      viewerEmail: "viewer@example.com",
    });

    expect(result).toEqual({ status: "ready", document: doc });
  });

  it("shares document by toggling visibility and upserting invite permission", async () => {
    documentsRepo.getDocumentRecordById.mockResolvedValue({ id: "doc-1", isPublic: false });
    documentsWriteRepo.updateDocumentRecord.mockResolvedValue({ id: "doc-1", isPublic: true });
    permissionsWriteRepo.upsertPermission.mockResolvedValue({
      id: "perm-1",
      documentId: "doc-1",
      email: "viewer@example.com",
      role: "viewer",
      createdAt: now,
    });

    const service = createSharingService({
      documentsRepo,
      documentsWriteRepo,
      permissionsRepo,
      permissionsWriteRepo,
      sharesRepo,
      generateId: () => "perm-1",
      generateToken: () => "token-1",
      now: () => now,
      isOwnerEmail: () => false,
    });

    const result = await service.shareDocument({
      documentId: "doc-1",
      isPublic: true,
      inviteEmail: "Viewer@Example.com",
    });

    expect(result.ok).toBe(true);
    expect(documentsWriteRepo.updateDocumentRecord).toHaveBeenCalledWith("doc-1", {
      isPublic: true,
    });
    expect(permissionsWriteRepo.upsertPermission).toHaveBeenCalledWith({
      id: "perm-1",
      documentId: "doc-1",
      email: "viewer@example.com",
      role: "viewer",
      createdAt: now,
    });
  });
});
