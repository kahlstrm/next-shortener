import { z } from "zod";

export const formSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .max(2000, "URL must be shorter than 2000 characters"),
  shorthand: z
    .string()
    .max(30, "shorthand must be less than 30 characters")
    .optional(),
});
