// Shared finance helpers for LedgerShift

export function formatMoney(amount, currency = "USD") {
  const value = Number(amount || 0);
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (currency === "LBP") return `${formatted} LBP`;
  if (currency === "USD") return `$${formatted}`;
  return `${formatted} ${currency}`; // CNY, EUR, ...
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Compute invoice totals from line items
export function computeInvoiceTotals(lineItems, discount = 0, tax = 0, totalCost = 0, partner = null) {
  const subtotal = lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
  const costTotal = totalCost > 0
    ? Number(totalCost)
    : lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unit_cost) || 0), 0);
  const grossProfit = total - costTotal;

  let partnerShare = 0;
  if (partner && partner.default_share_type === "percentage") {
    partnerShare = (grossProfit * (Number(partner.default_share_value) || 0)) / 100;
  } else if (partner && partner.default_share_type === "fixed_amount") {
    partnerShare = Number(partner.default_share_value) || 0;
  }
  return { subtotal, total, costTotal, grossProfit, partnerShare };
}

// Outstanding for a single invoice = total - sum of linked payments
export function invoiceOutstanding(invoice, payments = []) {
  const paid = payments
    .filter((p) => p.invoice_id === invoice.id)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(invoice.total_amount) || 0) - paid);
}

// Customer outstanding across all invoices/payments
export function customerOutstanding(invoices = [], payments = []) {
  const totalInvoiced = invoices.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Math.max(0, totalInvoiced - totalPaid);
}

// Customer status: Overdue (red) > Outstanding (amber) > Paid (green)
export function customerStatus(invoices = [], payments = []) {
  const hasOverdue = invoices.some((i) => i.status === "Overdue");
  const outstanding = customerOutstanding(invoices, payments);
  if (hasOverdue) return { key: "overdue", color: "bg-red-100 text-red-700 border-red-200" };
  if (outstanding > 0) return { key: "outstanding", color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { key: "paid", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
}

export function statusColor(status) {
  switch (status) {
    case "Paid": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Partially Paid": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Overdue": return "bg-red-100 text-red-700 border-red-200";
    case "Issued": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Draft": return "bg-slate-100 text-slate-600 border-slate-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function monthKey(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).slice(0, 7); // YYYY-MM
}

export function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const now = new Date();
  return String(dateStr).slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
