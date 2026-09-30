const finding = (code, severity, title, description, options = {}) => ({
  code,
  severity,
  title,
  description,
  passed: false,
  ...options,
});
const passed = (code, title, description, options = {}) => ({
  code,
  severity: "info",
  title,
  description,
  passed: true,
  ...options,
});
const sameText = (a, b) =>
  a && b && a.trim().toLowerCase() === b.trim().toLowerCase();

export async function validateDocument(document, supabase) {
  const results = [];
  if (!document.vendor_name)
    results.push(
      finding(
        "MISSING_VENDOR",
        "warning",
        "Vendor missing",
        "No vendor name was found.",
        { field_name: "vendor_name" },
      ),
    );
  else
    results.push(
      passed(
        "VENDOR_PRESENT",
        "Vendor captured",
        "A vendor name was extracted.",
        { field_name: "vendor_name" },
      ),
    );
  if (!document.document_number)
    results.push(
      finding(
        "MISSING_DOCUMENT_NUMBER",
        "warning",
        "Document number missing",
        "No document number was found.",
        { field_name: "document_number" },
      ),
    );
  if (document.total_amount == null)
    results.push(
      finding(
        "MISSING_TOTAL",
        "critical",
        "Total amount missing",
        "The total amount needs review.",
        { field_name: "total_amount" },
      ),
    );
  if (!document.document_date)
    results.push(
      finding(
        "MISSING_DATE",
        "warning",
        "Date missing",
        "No document date was found.",
        { field_name: "document_date" },
      ),
    );
  if (
    [document.subtotal, document.tax_amount, document.total_amount].some(
      (v) => v != null && Number(v) < 0,
    )
  )
    results.push(
      finding(
        "INVALID_MONEY",
        "critical",
        "Invalid monetary value",
        "Amounts cannot be negative.",
      ),
    );
  if (
    document.subtotal != null &&
    document.tax_amount != null &&
    document.total_amount != null
  ) {
    const calculated = Number(document.subtotal) + Number(document.tax_amount);
    const delta = Math.abs(calculated - Number(document.total_amount));
    if (delta > Math.max(1, Number(document.total_amount) * 0.01))
      results.push(
        finding(
          "TOTAL_MISMATCH",
          "warning",
          "Total calculation differs",
          "Subtotal plus tax does not match the extracted total.",
          {
            expected_value: calculated.toFixed(2),
            actual_value: Number(document.total_amount).toFixed(2),
            metadata: { difference: delta },
          },
        ),
      );
    else
      results.push(
        passed(
          "TOTAL_MATCH",
          "Total calculation consistent",
          "Subtotal plus tax is consistent with the total.",
        ),
      );
  }
  if (
    document.document_date &&
    new Date(document.document_date) > new Date(Date.now() + 86400000)
  )
    results.push(
      finding(
        "FUTURE_DATE",
        "warning",
        "Future document date",
        "The document date is in the future.",
        { field_name: "document_date" },
      ),
    );
  if (document.gstin) {
    const valid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(
      document.gstin,
    );
    results.push(
      valid
        ? passed(
            "GSTIN_FORMAT",
            "GSTIN format valid",
            "The identifier matches the expected GSTIN format.",
            { field_name: "gstin" },
          )
        : finding(
            "GSTIN_FORMAT",
            "warning",
            "GSTIN format invalid",
            "The identifier does not match the expected GSTIN format.",
            { field_name: "gstin" },
          ),
    );
  }

  if (document.document_number && document.vendor_name) {
    let query = supabase
      .from("documents")
      .select("id")
      .eq("user_id", document.user_id)
      .neq("id", document.id)
      .ilike("document_number", document.document_number)
      .ilike("vendor_name", document.vendor_name)
      .limit(1);
    if (document.document_date)
      query = query.eq("document_date", document.document_date);
    if (document.total_amount != null)
      query = query.eq("total_amount", document.total_amount);
    const { data } = await query;
    if (data?.length)
      results.push(
        finding(
          "LIKELY_DUPLICATE",
          "critical",
          "Likely duplicate document",
          "A document with the same vendor, number, date, and amount already exists.",
          { metadata: { duplicateDocumentId: data[0].id } },
        ),
      );
  }

  if (document.document_type === "invoice" && document.purchase_order_number) {
    const { data: po } = await supabase
      .from("documents")
      .select("id,total_amount,document_number")
      .eq("user_id", document.user_id)
      .eq("document_type", "purchase_order")
      .eq("processing_status", "completed")
      .ilike("document_number", document.purchase_order_number)
      .limit(1)
      .maybeSingle();
    if (!po)
      results.push(
        finding(
          "PO_NOT_FOUND",
          "warning",
          "Purchase order not found",
          "No processed purchase order matched this reference.",
          { field_name: "purchase_order_number" },
        ),
      );
    else {
      const difference = Math.abs(
        Number(document.total_amount || 0) - Number(po.total_amount || 0),
      );
      if (difference > Math.max(1, Number(po.total_amount || 0) * 0.01))
        results.push(
          finding(
            "PO_AMOUNT_MISMATCH",
            "critical",
            "Invoice and PO amounts differ",
            "The invoice total differs from the matched purchase order.",
            {
              expected_value: String(po.total_amount),
              actual_value: String(document.total_amount),
              metadata: { difference, referenceDocumentId: po.id },
            },
          ),
        );
      else
        results.push(
          passed(
            "PO_MATCH",
            "Purchase order matched",
            "The reference and total match a processed purchase order.",
            { metadata: { referenceDocumentId: po.id } },
          ),
        );
    }
  }
  return results;
}

export function assessRisk(results) {
  const weights = {
    LIKELY_DUPLICATE: 40,
    PO_AMOUNT_MISMATCH: 25,
    MISSING_TOTAL: 15,
    MISSING_VENDOR: 15,
    MISSING_DOCUMENT_NUMBER: 15,
    TOTAL_MISMATCH: 10,
    FUTURE_DATE: 10,
    INVALID_MONEY: 15,
  };
  const score = Math.min(
    100,
    results
      .filter((r) => !r.passed)
      .reduce(
        (sum, r) =>
          sum +
          (weights[r.code] ||
            (r.severity === "critical"
              ? 15
              : r.severity === "warning"
                ? 5
                : 0)),
        0,
      ),
  );
  return {
    score,
    level: score >= 60 ? "high" : score >= 30 ? "medium" : "low",
  };
}
