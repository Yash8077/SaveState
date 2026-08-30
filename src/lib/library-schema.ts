import { z } from "zod";
import { STATUSES } from "@/lib/types";

export const statusSchema = z.enum(STATUSES);

export const snapshotSchema = z.object({
  title: z.string().min(1),
  coverUrl: z.string().nullable(),
  headerUrl: z.string().nullable(),
  summary: z.string().nullable(),
  releaseDate: z.string().nullable(),
  platforms: z.array(z.string()),
  genres: z.array(z.string()),
  metacritic: z.number().nullable(),
  developers: z.array(z.string()),
  publishers: z.array(z.string()),
  screenshots: z.array(z.string()),
});

export const addToLibraryInput = z.object({
  catalogId: z.string().min(1),
  status: statusSchema.optional(),
  snapshot: snapshotSchema,
});

export const addCustomGameInput = z.object({
  title: z.string().trim().min(1).max(160),
  status: statusSchema.optional(),
  notes: z.string().max(4000).optional(),
});

export const updateEntryInput = z.object({
  id: z.number().int(),
  status: statusSchema.optional(),
  score: z.number().int().min(1).max(10).nullable().optional(),
  hours: z.number().min(0).max(10000).nullable().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
});

export const listLibraryInput = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).default({});

export type AddToLibraryInput = z.infer<typeof addToLibraryInput>;
export type AddCustomGameInput = z.infer<typeof addCustomGameInput>;
export type UpdateEntryInput = z.infer<typeof updateEntryInput>;
