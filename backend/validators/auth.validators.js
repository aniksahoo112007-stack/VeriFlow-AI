import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[a-z]/, "Use a lowercase letter")
    .regex(/[A-Z]/, "Use an uppercase letter")
    .regex(/[0-9]/, "Use a number"),
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export const googleSchema = z.object({ credential: z.string().min(20) });
