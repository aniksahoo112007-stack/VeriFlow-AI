import { z } from "zod";

const nullableText = z.union([z.string().trim().max(300), z.null()]).optional();
const nullableLongText = z
  .union([z.string().trim().max(1000), z.null()])
  .optional();
const nullableMoney = z
  .union([z.coerce.number().finite(), z.null()])
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
      "payment",
      "expense_bill",
      "form",
      "contract",
      "other",
    ])
    .default("other"),
  vendorName: nullableText,
  vendorAddress: nullableLongText,
  vendorPhone: nullableText,
  vendorEmail: z
    .union([z.email().max(300), z.string().trim().max(300), z.null()])
    .optional(),
  documentNumber: nullableText,
  invoiceNumber: nullableText,
  receiptNumber: nullableText,
  purchaseOrderNumber: nullableText,
  utrNumber: nullableText,
  transactionId: nullableText,
  referenceNumber: nullableText,
  documentDate: nullableDate,
  transactionDate: nullableDate,
  dueDate: nullableDate,
  currency: nullableText,
  subtotal: nullableMoney,
  taxAmount: nullableMoney,
  gstAmount: nullableMoney,
  cgst: nullableMoney,
  sgst: nullableMoney,
  igst: nullableMoney,
  discount: nullableMoney,
  totalAmount: nullableMoney,
  paidAmount: nullableMoney,
  balanceAmount: nullableMoney,
  gstin: nullableText,
  pan: nullableText,
  bankName: nullableText,
  accountLast4: z
    .union([z.string().trim().regex(/^\d{4}$/), z.null()])
    .optional(),
  paymentMethod: nullableText,
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
  visibleLogos: z
    .union([z.array(z.string().trim().max(300)).max(20), z.null()])
    .optional(),
  visibleStamps: z
    .union([z.array(z.string().trim().max(300)).max(20), z.null()])
    .optional(),
  visibleSignatures: z
    .union([z.array(z.string().trim().max(300)).max(20), z.null()])
    .optional(),
  confidence: z.coerce.number().min(0).max(1).default(0),
  missingFields: z.array(z.string().max(100)).default([]),
  warnings: z.array(z.string().max(500)).default([]),
});

export const anomalyAnalysisSchema = z.object({
  anomalies: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(100),
        severity: z.enum(["info", "warning", "critical"]),
        reason: z.string().trim().min(1).max(500),
        evidence: z.string().trim().min(1).max(500),
      }),
    )
    .max(30)
    .default([]),
});

export const editExtractionSchema = extractionSchema
  .pick({
    documentType: true,
    vendorName: true,
    vendorAddress: true,
    vendorPhone: true,
    vendorEmail: true,
    documentNumber: true,
    invoiceNumber: true,
    receiptNumber: true,
    documentDate: true,
    transactionDate: true,
    currency: true,
    subtotal: true,
    taxAmount: true,
    gstAmount: true,
    cgst: true,
    sgst: true,
    igst: true,
    discount: true,
    totalAmount: true,
    paidAmount: true,
    balanceAmount: true,
    purchaseOrderNumber: true,
    utrNumber: true,
    transactionId: true,
    referenceNumber: true,
    gstin: true,
    pan: true,
    bankName: true,
    accountLast4: true,
    paymentMethod: true,
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
