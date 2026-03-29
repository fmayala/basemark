import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shareLinks } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/email";
import { isOwnerEmail as defaultIsOwnerEmail } from "@/lib/authz";
import {
  getDocumentRecordById,
  updateDocumentRecord,
} from "@/domain/repos/documents-repo";
import {
  listPermissionsForDocument,
  upsertPermission,
} from "@/domain/repos/permissions-repo";

type DocumentsReadRepo = {
  getDocumentRecordById: typeof getDocumentRecordById;
};

type DocumentsWriteRepo = {
  updateDocumentRecord: typeof updateDocumentRecord;
};

type PermissionsReadRepo = {
  listPermissionsForDocument: typeof listPermissionsForDocument;
};

type PermissionsWriteRepo = {
  upsertPermission: typeof upsertPermission;
};

type SharesRepo = {
  createShareLinkRecord: (input: {
    id: string;
    documentId: string;
    token: string;
    expiresAt: number | null;
    createdAt: number;
  }) => Promise<{ token: string }>;
  getShareLinkByToken: (token: string) => Promise<{
    documentId: string;
    expiresAt: number | null;
  } | null>;
};

type CreateSharingServiceOptions = {
  documentsRepo?: DocumentsReadRepo;
  documentsWriteRepo?: DocumentsWriteRepo;
  permissionsRepo?: PermissionsReadRepo;
  permissionsWriteRepo?: PermissionsWriteRepo;
  sharesRepo?: SharesRepo;
  generateId?: () => string;
  generateToken?: () => string;
  now?: () => number;
  isOwnerEmail?: (email: string | null | undefined) => boolean;
};

type SharedDocument = {
  id: string;
  isPublic: boolean;
  [key: string]: unknown;
};

type SharePermission = {
  email: string;
  [key: string]: unknown;
};

type CreateShareLinkResult =
  | { ok: true; token: string; url: string }
  | { ok: false; reason: "invalid_expires_at" | "expires_in_past" | "document_not_found" };

type ResolveSharedDocumentResult =
  | { status: "ready"; document: SharedDocument }
  | { status: "auth_required" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "not_found" };

type ShareDocumentResult =
  | { ok: false; reason: "not_found" }
  | { ok: true; document: SharedDocument; permission: unknown | null };

const defaultSharesRepo: SharesRepo = {
  async createShareLinkRecord(input) {
    const [row] = await db
      .insert(shareLinks)
      .values({
        id: input.id,
        documentId: input.documentId,
        token: input.token,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      })
      .returning({ token: shareLinks.token });
    return row;
  },

  async getShareLinkByToken(token) {
    const row = await db
      .select({ documentId: shareLinks.documentId, expiresAt: shareLinks.expiresAt })
      .from(shareLinks)
      .where(eq(shareLinks.token, token))
      .get();
    return row ?? null;
  },
};

export function createSharingService(options: CreateSharingServiceOptions = {}) {
  const documentsRepo = options.documentsRepo ?? { getDocumentRecordById };
  const documentsWriteRepo = options.documentsWriteRepo ?? { updateDocumentRecord };
  const permissionsRepo = options.permissionsRepo ?? { listPermissionsForDocument };
  const permissionsWriteRepo = options.permissionsWriteRepo ?? { upsertPermission };
  const sharesRepo = options.sharesRepo ?? defaultSharesRepo;
  const generateId = options.generateId ?? nanoid;
  const generateToken = options.generateToken ?? (() => nanoid(16));
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const isOwnerEmail = options.isOwnerEmail ?? defaultIsOwnerEmail;

  return {
    async createShareLink(input: {
      documentId: string;
      expiresAt?: string;
    }): Promise<CreateShareLinkResult> {
      const currentTime = now();
      let expiresAtSeconds: number | null = null;

      if (input.expiresAt) {
        const parsed = new Date(input.expiresAt);
        const timestamp = parsed.getTime();
        if (Number.isNaN(timestamp)) {
          return { ok: false, reason: "invalid_expires_at" };
        }

        expiresAtSeconds = Math.floor(timestamp / 1000);
        if (expiresAtSeconds <= currentTime) {
          return { ok: false, reason: "expires_in_past" };
        }
      }

      const doc = await documentsRepo.getDocumentRecordById(input.documentId);
      if (!doc) {
        return { ok: false, reason: "document_not_found" };
      }

      const token = generateToken();
      await sharesRepo.createShareLinkRecord({
        id: generateId(),
        documentId: input.documentId,
        token,
        expiresAt: expiresAtSeconds,
        createdAt: currentTime,
      });

      return { ok: true, token, url: `/share/${token}` };
    },

    async resolveSharedDocument(input: {
      token: string;
      viewerEmail?: string;
    }): Promise<ResolveSharedDocumentResult> {
      const link = await sharesRepo.getShareLinkByToken(input.token);
      if (link) {
        if (link.expiresAt && link.expiresAt < now()) {
          return { status: "expired" };
        }

        const linkedDoc = (await documentsRepo.getDocumentRecordById(
          link.documentId,
        )) as SharedDocument | null;
        if (linkedDoc) {
          return { status: "ready", document: linkedDoc };
        }
      }

      const doc = (await documentsRepo.getDocumentRecordById(
        input.token,
      )) as SharedDocument | null;
      if (!doc) return { status: "not_found" };

      if (doc.isPublic) {
        return { status: "ready", document: doc };
      }

      if (!input.viewerEmail) {
        return { status: "auth_required" };
      }

      if (isOwnerEmail(input.viewerEmail)) {
        return { status: "ready", document: doc };
      }

      const normalizedEmail = normalizeEmail(input.viewerEmail);
      const permissions = (await permissionsRepo.listPermissionsForDocument(
        doc.id,
      )) as SharePermission[];

      const hasPermission = permissions.some(
        (permission) => normalizeEmail(permission.email) === normalizedEmail,
      );

      if (hasPermission) {
        return { status: "ready", document: doc };
      }

      return { status: "denied" };
    },

    async shareDocument(input: {
      documentId: string;
      isPublic?: boolean;
      inviteEmail?: string;
    }): Promise<ShareDocumentResult> {
      const existing = (await documentsRepo.getDocumentRecordById(
        input.documentId,
      )) as SharedDocument | null;
      if (!existing) {
        return { ok: false, reason: "not_found" };
      }

      let document = existing;
      if (input.isPublic !== undefined) {
        const updated = (await documentsWriteRepo.updateDocumentRecord(input.documentId, {
          isPublic: input.isPublic,
        })) as SharedDocument | null;
        if (!updated) {
          return { ok: false, reason: "not_found" };
        }
        document = updated;
      }

      let permission: unknown | null = null;
      if (input.inviteEmail) {
        permission = await permissionsWriteRepo.upsertPermission({
          id: generateId(),
          documentId: input.documentId,
          email: normalizeEmail(input.inviteEmail),
          role: "viewer",
          createdAt: now(),
        });
      }

      return {
        ok: true,
        document,
        permission,
      };
    },
  };
}
