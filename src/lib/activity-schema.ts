import { z } from "zod";

export const createPs5DeviceInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export const activityEventInput = z.object({
  sourceRowid: z.number().int().nonnegative(),
  titleId: z.string().trim().min(1).max(64),
  titleName: z.string().trim().max(200).nullable().optional(),
  createdDate: z.string().trim().min(1).max(64),
  totalFgTime: z.number().int().nonnegative().max(86400 * 30),
});

export const ingestPs5ActivityInput = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string().uuid(),
  events: z.array(activityEventInput).min(1).max(500),
});

export type ActivityEventInput = z.infer<typeof activityEventInput>;
