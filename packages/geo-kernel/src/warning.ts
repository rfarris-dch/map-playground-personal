import { z } from "zod";

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type Warning = z.infer<typeof WarningSchema>;
