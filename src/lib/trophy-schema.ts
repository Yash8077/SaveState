import { z } from "zod";

const trophyIdSchema = z.number().int().min(0).max(10000);

const trophyGameSchema = z.object({
  titleId: z.string().trim().min(1).max(64),
  trophyTitleId: z
    .string()
    .trim()
    .regex(/^NPWR\d+_00$/i)
    .optional(),
  trophyIds: z.array(trophyIdSchema).max(1000),
});

export const trophySyncInput = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string().trim().min(1).max(64),
  games: z.array(trophyGameSchema).max(500),
});

export const trophyCatalogInput = z.object({
  platform: z.enum(["ps4", "ps5"]),
  trophyTitleId: z.string().trim().regex(/^NPWR\d+_00$/i),
  trophies: z.array(
    z.object({
      trophyId: z.number().int().min(0).max(10000),
      trophyGroupId: z.string().nullable().optional(),
      trophyType: z.string().nullable().optional(),
      trophyName: z.string().nullable().optional(),
      trophyDetail: z.string().nullable().optional(),
      trophyIconUrl: z.string().nullable().optional(),
      trophyHidden: z.boolean().nullable().optional(),
      trophyProgressTargetValue: z.union([z.string(), z.number()]).nullable().optional(),
    }),
  ).max(2000),
});

export type TrophySyncInput = z.infer<typeof trophySyncInput>;
export type TrophyCatalogInput = z.infer<typeof trophyCatalogInput>;
