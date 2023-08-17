import { z } from "zod";

export const formSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .max(500, "URL must be less than 500 characters"),
  shorthand: z
    .string()
    .max(30, "shorthand must be less than 30 characters")
    .optional(),
});
