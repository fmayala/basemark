import { z } from "zod";
import {
  MAX_COLLECTION_NAME_LENGTH,
  MAX_DOCUMENT_CONTENT_LENGTH,
  MAX_DOCUMENT_TITLE_LENGTH,
  normalizedEmailSchema,
} from "@/lib/validation";

export const mcpCreateDocInputSchema = z.object({
  title: z.string().max(MAX_DOCUMENT_TITLE_LENGTH),
  content: z.string().max(MAX_DOCUMENT_CONTENT_LENGTH).optional(),
  collectionId: z.string().optional(),
});

export const mcpUpdateDocInputSchema = z.object({
  id: z.string(),
  title: z.string().max(MAX_DOCUMENT_TITLE_LENGTH).optional(),
  content: z.string().max(MAX_DOCUMENT_CONTENT_LENGTH).optional(),
});

export const mcpCreateCollectionInputSchema = z.object({
  name: z.string().min(1).max(MAX_COLLECTION_NAME_LENGTH),
});

export const mcpShareInputSchema = z.object({
  id: z.string(),
  isPublic: z.boolean().optional(),
  inviteEmail: normalizedEmailSchema.optional(),
});
