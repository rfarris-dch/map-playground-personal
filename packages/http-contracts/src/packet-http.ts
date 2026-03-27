import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";
import { ConfidenceVectorSchema, TruthModeSchema } from "./confidence-http.js";

export const PacketAudienceSchema = z.enum(["internal", "external"]);

export const PacketSectionSchema = z.object({
  packetId: z.string().min(1),
  sectionKey: z.string().min(1),
  title: z.string().min(1),
  audience: PacketAudienceSchema,
  objectScope: z.string().min(1),
  objectId: z.string().min(1),
  truthMode: TruthModeSchema,
  confidence: ConfidenceVectorSchema,
  sourceIds: z.array(z.string().min(1)),
  summary: z.string().min(1).nullable(),
});

export const PacketSectionCollectionResponseSchema = z.object({
  status: z.literal("ok"),
  sections: z.array(PacketSectionSchema),
  meta: ResponseMetaSchema,
});

export type PacketAudience = z.infer<typeof PacketAudienceSchema>;
export type PacketSection = z.infer<typeof PacketSectionSchema>;
export type PacketSectionCollectionResponse = z.infer<typeof PacketSectionCollectionResponseSchema>;
