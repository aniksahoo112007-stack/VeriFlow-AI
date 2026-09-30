import { z } from "zod";

const nullableText = z.union([z.string().trim().max(300), z.null()]).optional();
const nullableMoney = z
  .union([z.coerce.number().finite().nonnegative(), z.null()])
  .optional();
const nullableDate = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);

export const extractionSchema = z.object({
  documentType: z
    .enum([
      "invoice",
      "purchase_order",
      "receipt",
      "expense_bill",
      "form",
      "contract",
      "other",
    ])
    .default("other"),
  vendorName: nullableText,
  documentNumber: nullableText,
  documentDate: nullableDate,
  currency: nullableText,
  subtotal: nullableMoney,
  taxAmount: nullableMoney,
  totalAmount: nullableMoney,
  purchaseOrderNumber: nullableText,
  gstin: nullableText,
  dueDate: nullableDate,
  lineItems: z
    .array(
      z.object({
        description: z.string().trim().max(500),
        quantity: nullableMoney,
        unitPrice: nullableMoney,
        amount: nullableMoney,
      }),
    )
    .max(200)
    .default([]),
  summary: z.union([z.string().trim().max(2000), z.null()]).optional(),
  confidence: z.coerce.number().min(0).max(1).default(0),
  missingFields: z.array(z.string().max(100)).default([]),
  warnings: z.array(z.string().max(500)).default([]),
});

export const editExtractionSchema = extractionSchema
  .pick({
    documentType: true,
    vendorName: true,
    documentNumber: true,
    documentDate: true,
    currency: true,
    subtotal: true,
    taxAmount: true,
    totalAmount: true,
    purchaseOrderNumber: true,
    gstin: true,
    dueDate: true,
    lineItems: true,
    summary: true,
  })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field",
  );

export const reviewSchema = z.object({
  action: z.enum(["approved", "rejected", "review_requested"]),
  comment: z.string().trim().max(1000).optional().default(""),
});
