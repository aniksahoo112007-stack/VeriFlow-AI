export const money = (value, currency = "INR") =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency || "INR",
        maximumFractionDigits: 2,
      }).format(value);
export const date = (value, withTime = false) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" } : {}),
      }).format(new Date(value))
    : "—";
export const title = (value = "") =>
  value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
