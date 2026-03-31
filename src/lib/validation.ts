import { z } from "zod";
import { normalizeEmail } from "@/lib/email";

export const MAX_DOCUMENT_CONTENT_LENGTH = 500_000;
export const MAX_DOCUMENT_TITLE_LENGTH = 300;
export const MAX_COLLECTION_NAME_LENGTH = 120;

export const createDocumentSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  title: z.string().max(MAX_DOCUMENT_TITLE_LENGTH).optional(),
  content: z.string().max(MAX_DOCUMENT_CONTENT_LENGTH).optional(),
  collectionId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isPublic: z.boolean().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().max(MAX_DOCUMENT_TITLE_LENGTH).optional(),
  content: z.string().max(MAX_DOCUMENT_CONTENT_LENGTH).optional(),
  collectionId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isPublic: z.boolean().optional(),
  baseUpdatedAt: z.number().int().nonnegative().optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(MAX_COLLECTION_NAME_LENGTH),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(MAX_COLLECTION_NAME_LENGTH).optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export const createShareSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  expiresAt: z.string().optional(),
});

export const normalizedEmailSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeEmail(value) : value),
  z.string().email("Valid email is required"),
);

export const createPermissionSchema = z.object({
  email: normalizedEmailSchema,
  role: z.enum(["viewer", "editor"]).optional(),
});
