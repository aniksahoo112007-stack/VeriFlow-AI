const finding = (code, severity, title, description, options = {}) => ({ code, severity, title, description, passed: false, ...options });
const passed = (code, title, description, options = {}) => ({ code, severity: "info", title, description, passed: true, ...options });
const clean = (value) => String(value ?? "").trim();
const sameText = (a, b) => Boolean(clean(a)) && clean(a).toLowerCase() === clean(b).toLowerCase();
const tolerance = (amount) => Math.max(1, Math.abs(Number(amount) || 0) * 0.01);

async function findDuplicate(supabase, document, column, value) {
  if (!clean(value)) return null;
  const { data, error } = await supabase.from("documents").select("id,vendor_name").eq("user_id", document.user_id).neq("id", document.id).ilike(column, clean(value)).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function validateDocument(document, supabase) {
  const results = [];
  const type = document.document_type;
  const paymentDocument = ["receipt", "payment"].includes(type);
  const primaryNumber = type === "invoice" ? document.invoice_number || document.document_number : type === "purchase_order" ? document.purchase_order_number || document.document_number : type === "receipt" ? document.receipt_number || document.document_number : document.document_number;

  if (document.total_amount == null) results.push(finding("MISSING_TOTAL", "critical", "Total amount missing", "No total amount was clearly visible.", { field_name: "total_amount" }));
  if (!type && !document.vendor_name) results.push(finding("MISSING_VENDOR", "warning", "Vendor missing", "No vendor name was clearly visible.", { field_name: "vendor_name" }));
  if (!type && !document.document_number) results.push(finding("MISSING_DOCUMENT_NUMBER", "warning", "Document number missing", "No document number was clearly visible.", { field_name: "document_number" }));

  if (!document.vendor_name && ["invoice", "purchase_order"].includes(type)) results.push(finding("MISSING_VENDOR", "warning", "Vendor missing", "No vendor name was clearly visible.", { field_name: "vendor_name" }));
  else if (document.vendor_name) results.push(passed("VENDOR_PRESENT", "Vendor captured", "A vendor name was extracted.", { field_name: "vendor_name" }));
  if (!primaryNumber && ["invoice", "purchase_order"].includes(type)) results.push(finding("MISSING_CRITICAL_IDENTIFIER", "warning", `${type === "invoice" ? "Invoice" : "Purchase order"} number missing`, "The expected primary document identifier was not visible.", { field_name: type === "invoice" ? "invoice_number" : "purchase_order_number" }));
  if (paymentDocument && ![document.utr_number, document.transaction_id, document.reference_number].some(clean)) results.push(finding("MISSING_CRITICAL_IDENTIFIER", "warning", "Payment identifier missing", "No UTR, transaction ID, or payment reference was clearly visible.", { field_name: "utr_number" }));
  if (paymentDocument && !document.payment_method) results.push(finding("MISSING_PAYMENT_METHOD", "warning", "Payment method missing", "No payment method was clearly visible.", { field_name: "payment_method" }));
  if (paymentDocument && document.paid_amount == null && document.total_amount == null) results.push(finding("MISSING_PAID_AMOUNT", "warning", "Paid amount missing", "No paid amount was clearly visible.", { field_name: "paid_amount" }));
  if (type === "purchase_order" && !(document.line_items?.length > 0)) results.push(finding("MISSING_PO_ITEMS", "warning", "Purchase order items missing", "No purchase-order line items were confidently extracted.", { field_name: "line_items" }));

  if (document.gstin) {
    const valid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(document.gstin);
    results.push(valid ? passed("GSTIN_FORMAT", "GSTIN format valid", "The GSTIN matches the expected format.", { field_name: "gstin" }) : finding("INVALID_GSTIN", "warning", "GSTIN format invalid", "The visible GSTIN does not match the expected format.", { field_name: "gstin" }));
  }

  const latest = Date.now() + 86400000;
  for (const [field, value] of [["document_date", document.document_date], ["transaction_date", document.transaction_date], ["due_date", document.due_date]]) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp) || timestamp < new Date("1900-01-01").getTime() || timestamp > latest) results.push(finding("DATE_INCONSISTENCY", "warning", "Date is inconsistent", `${field.replaceAll("_", " ")} is impossible or in the future.`, { field_name: field }));
  }
  if (document.document_date && document.due_date && new Date(document.due_date) < new Date(document.document_date)) results.push(finding("DATE_INCONSISTENCY", "warning", "Due date precedes document date", "The due date is earlier than the document date.", { field_name: "due_date" }));

  const moneyFields = ["subtotal", "tax_amount", "gst_amount", "cgst", "sgst", "igst", "discount", "total_amount", "paid_amount", "balance_amount"];
  const invalidMoney = moneyFields.filter((field) => document[field] != null && (Number(document[field]) < 0 || Math.abs(Number(document[field])) > 1e12));
  if (invalidMoney.length) results.push(finding("INVALID_MONEY", "critical", "Suspicious monetary value", "One or more monetary values are negative or unreasonably large.", { metadata: { fields: invalidMoney } }));

  if (document.subtotal != null && document.total_amount != null) {
    const gstComponents = [document.cgst, document.sgst, document.igst];
    const hasGstComponent = gstComponents.some((value) => value != null);
    const tax = document.tax_amount != null
      ? Number(document.tax_amount)
      : document.gst_amount != null
        ? Number(document.gst_amount)
        : hasGstComponent
          ? gstComponents.reduce((sum, value) => sum + (value == null ? 0 : Number(value)), 0)
          : null;
    if (tax != null) {
      const discount = document.discount != null ? Number(document.discount) : 0;
      const calculated = Number(document.subtotal) + tax - discount;
      const delta = Math.abs(calculated - Number(document.total_amount));
      results.push(delta > tolerance(document.total_amount) ? finding("TOTAL_MISMATCH", "critical", "Tax and total mismatch", "Subtotal plus taxes minus discount does not match the total.", { expected_value: calculated.toFixed(2), actual_value: Number(document.total_amount).toFixed(2), metadata: { difference: delta } }) : passed("TOTAL_MATCH", "Total calculation consistent", "Subtotal, taxes, discount, and total are consistent."));
    }
  }
  if (document.paid_amount != null && document.total_amount != null) {
    const expected = document.balance_amount != null ? Number(document.total_amount) - Number(document.balance_amount) : Number(document.total_amount);
    const delta = Math.abs(Number(document.paid_amount) - expected);
    if (delta > tolerance(document.total_amount)) results.push(finding("PAID_TOTAL_MISMATCH", "critical", "Paid amount mismatch", "The paid amount is inconsistent with the total and balance.", { expected_value: expected.toFixed(2), actual_value: Number(document.paid_amount).toFixed(2), metadata: { difference: delta } }));
  }

  const identifiers = [
    ["invoice_number", document.invoice_number, "DUPLICATE_INVOICE_NUMBER", "Duplicate invoice number"],
    ["document_number", document.document_number, "DUPLICATE_DOCUMENT_NUMBER", "Duplicate document number"],
    ["utr_number", document.utr_number, "DUPLICATE_UTR", "Duplicate UTR"],
    ["transaction_id", document.transaction_id, "DUPLICATE_TRANSACTION_ID", "Duplicate transaction ID"],
    ["reference_number", document.reference_number, "DUPLICATE_REFERENCE_NUMBER", "Duplicate reference number"],
  ];
  for (const [column, value, code, title] of identifiers) {
    const duplicate = await findDuplicate(supabase, document, column, value);
    if (duplicate) results.push(finding(code, "critical", title, "The same identifier appears on another uploaded document.", { field_name: column, metadata: { duplicateDocumentId: duplicate.id } }));
  }

  if (type === "invoice" && document.purchase_order_number) {
    const { data: po, error } = await supabase.from("documents").select("id,total_amount,document_number,purchase_order_number,vendor_name,currency").eq("user_id", document.user_id).eq("document_type", "purchase_order").eq("processing_status", "completed").or(`document_number.ilike.${document.purchase_order_number},purchase_order_number.ilike.${document.purchase_order_number}`).limit(1).maybeSingle();
    if (error) throw error;
    if (!po) results.push(finding("PO_NOT_FOUND", "warning", "Purchase order not found", "No processed purchase order matched the visible reference.", { field_name: "purchase_order_number" }));
    else {
      if (document.total_amount != null && po.total_amount != null && Math.abs(Number(document.total_amount) - Number(po.total_amount)) > tolerance(po.total_amount)) results.push(finding("PO_MISMATCH", "critical", "Invoice and PO totals differ", "The invoice total differs from the matched purchase order.", { expected_value: String(po.total_amount), actual_value: String(document.total_amount), metadata: { referenceDocumentId: po.id } }));
      if (document.vendor_name && po.vendor_name && !sameText(document.vendor_name, po.vendor_name)) results.push(finding("VENDOR_MISMATCH", "warning", "Invoice and PO vendors differ", "The visible vendor differs from the matched purchase order.", { metadata: { referenceDocumentId: po.id } }));
      if (document.currency && po.currency && !sameText(document.currency, po.currency)) results.push(finding("CURRENCY_INCONSISTENCY", "warning", "Invoice and PO currencies differ", "The extracted currencies are inconsistent.", { metadata: { referenceDocumentId: po.id } }));
      if (!results.some((result) => result.metadata?.referenceDocumentId === po.id && !result.passed)) results.push(passed("PO_MATCH", "Purchase order matched", "The invoice is consistent with the referenced purchase order.", { metadata: { referenceDocumentId: po.id } }));
    }
  }

  for (const anomaly of document.raw_extraction?.anomalies || []) results.push(finding(anomaly.severity === "critical" ? "AI_ANOMALY_CRITICAL" : anomaly.severity === "warning" ? "AI_ANOMALY_WARNING" : "AI_ANOMALY_INFO", anomaly.severity, `AI-assisted anomaly: ${anomaly.type}`, anomaly.reason, { metadata: { evidence: anomaly.evidence, aiAssisted: true } }));
  return results;
}

export function assessRisk(results) {
  const weights = { LIKELY_DUPLICATE: 40, DUPLICATE_INVOICE_NUMBER: 40, DUPLICATE_DOCUMENT_NUMBER: 40, DUPLICATE_UTR: 40, DUPLICATE_TRANSACTION_ID: 40, DUPLICATE_REFERENCE_NUMBER: 40, TOTAL_MISMATCH: 25, PAID_TOTAL_MISMATCH: 25, PO_AMOUNT_MISMATCH: 25, INVALID_GSTIN: 15, PO_MISMATCH: 20, MISSING_TOTAL: 15, MISSING_VENDOR: 15, MISSING_DOCUMENT_NUMBER: 15, MISSING_CRITICAL_IDENTIFIER: 10, DATE_INCONSISTENCY: 10, VENDOR_MISMATCH: 15, CURRENCY_INCONSISTENCY: 10, INVALID_MONEY: 20, AI_ANOMALY_WARNING: 10, AI_ANOMALY_CRITICAL: 20 };
  const score = Math.min(100, results.filter((result) => !result.passed).reduce((sum, result) => sum + (weights[result.code] || 0), 0));
  return { score, level: score >= 60 ? "high" : score >= 30 ? "medium" : "low" };
}
