/**
 * Pure money / allocation math for LedgerShift.
 * Everything here is side-effect free so it can be unit-tested without a DB.
 *
 * Conventions:
 * - Totals are rounded to 2 decimals, unit costs to 4 (imports often have
 *   thousands of cheap units, so 2-decimal unit costs would lose precision).
 * - Line totals are authoritative: sum(allocatedLineLandedCostTotal) always
 *   equals totalLandedCostAmount exactly (rounding drift goes to the biggest line).
 */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Sales invoice totals
// ---------------------------------------------------------------------------

export interface InvoiceLineCalcInput {
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
}

export interface PartnerShareRule {
  defaultShareType: string; // "none" | "percentage" | "fixed_amount"
  defaultShareValue: number;
}

export interface InvoiceTotals {
  subtotalAmount: number;
  totalAmount: number;
  totalCostAmount: number;
  grossProfitAmount: number;
  partnerShareAmount: number;
}

/** Partner share of gross profit, based on the partner's default rule. */
export function computePartnerShare(grossProfit: number, partner?: PartnerShareRule | null): number {
  if (!partner) return 0;
  if (partner.defaultShareType === "percentage") {
    return round2((grossProfit * partner.defaultShareValue) / 100);
  }
  if (partner.defaultShareType === "fixed_amount") {
    return round2(partner.defaultShareValue);
  }
  return 0;
}

/** Compute all invoice totals from its lines + discount/tax + partner rule. */
export function computeInvoiceTotals(
  lines: InvoiceLineCalcInput[],
  discountAmount = 0,
  taxAmount = 0,
  partner?: PartnerShareRule | null,
): InvoiceTotals {
  const subtotalAmount = round2(
    lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
  );
  const totalAmount = Math.max(0, round2(subtotalAmount - discountAmount + taxAmount));
  const totalCostAmount = round2(
    lines.reduce((sum, l) => sum + l.quantity * (l.unitCost ?? 0), 0),
  );
  const grossProfitAmount = round2(totalAmount - totalCostAmount);
  return {
    subtotalAmount,
    totalAmount,
    totalCostAmount,
    grossProfitAmount,
    partnerShareAmount: computePartnerShare(grossProfitAmount, partner),
  };
}

// ---------------------------------------------------------------------------
// Customer balance
// ---------------------------------------------------------------------------

export interface CustomerBalance {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
}

/** Outstanding = total invoiced − total paid (never negative). */
export function computeCustomerBalance(
  invoices: Array<{ totalAmount: number }>,
  payments: Array<{ amount: number }>,
): CustomerBalance {
  const totalInvoiced = round2(invoices.reduce((s, i) => s + i.totalAmount, 0));
  const totalPaid = round2(payments.reduce((s, p) => s + p.amount, 0));
  return { totalInvoiced, totalPaid, outstanding: Math.max(0, round2(totalInvoiced - totalPaid)) };
}

// ---------------------------------------------------------------------------
// Partner share summary
// ---------------------------------------------------------------------------

export interface PartnerShareSummary {
  shareDue: number;
  sharePaid: number;
  remaining: number;
}

/**
 * A partner's share is considered "paid" in proportion to how much of each
 * invoice has been collected. paidRatio = min(1, collected / invoiceTotal).
 */
export function computePartnerShareSummary(
  invoices: Array<{ totalAmount: number; partnerShareAmount: number }>,
  paymentsByInvoice: Map<string, number>,
  invoiceIds: string[],
): PartnerShareSummary {
  let shareDue = 0;
  let sharePaid = 0;
  invoices.forEach((inv, idx) => {
    shareDue += inv.partnerShareAmount;
    const collected = paymentsByInvoice.get(invoiceIds[idx]) ?? 0;
    const ratio = inv.totalAmount > 0 ? Math.min(1, collected / inv.totalAmount) : 1;
    sharePaid += inv.partnerShareAmount * ratio;
  });
  return {
    shareDue: round2(shareDue),
    sharePaid: round2(sharePaid),
    remaining: round2(Math.max(0, shareDue - sharePaid)),
  };
}

// ---------------------------------------------------------------------------
// Landed cost allocation (imports)
// ---------------------------------------------------------------------------

export interface PurchaseLineCalcInput {
  quantityImported: number;
  unitPurchasePrice: number;
}

export interface ExtraCosts {
  freightAmount?: number;
  dutyAmount?: number;
  customsFeesAmount?: number;
  otherFeesAmount?: number;
}

export interface AllocatedPurchaseLine {
  linePurchaseTotal: number;
  allocatedExtraCost: number;
  allocatedUnitLandedCost: number;
  allocatedLineLandedCostTotal: number;
}

export interface LandedCostResult {
  productsSubtotalAmount: number;
  totalExtraCosts: number;
  totalLandedCostAmount: number;
  lines: AllocatedPurchaseLine[];
}

export type AllocationMethod = "value" | "quantity";

/**
 * Spread freight/duty/customs/other over the purchase lines.
 * - "value": proportional to each line's purchase total (default, fairest).
 * - "quantity": equal share per unit; also the fallback when subtotal is 0.
 * Any rounding drift is added to the largest line so totals always reconcile.
 */
export function allocateLandedCosts(
  lines: PurchaseLineCalcInput[],
  extras: ExtraCosts,
  method: AllocationMethod = "value",
): LandedCostResult {
  const totalExtraCosts = round2(
    (extras.freightAmount ?? 0) +
      (extras.dutyAmount ?? 0) +
      (extras.customsFeesAmount ?? 0) +
      (extras.otherFeesAmount ?? 0),
  );

  const purchaseTotals = lines.map((l) => round2(l.quantityImported * l.unitPurchasePrice));
  const productsSubtotalAmount = round2(purchaseTotals.reduce((s, v) => s + v, 0));

  const useQuantity = method === "quantity" || productsSubtotalAmount <= 0;
  const weights = lines.map((l, i) => (useQuantity ? l.quantityImported : purchaseTotals[i]));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const allocated = purchaseTotals.map((lineTotal, i) => {
    const extra = totalWeight > 0 ? round2((totalExtraCosts * weights[i]) / totalWeight) : 0;
    return { lineTotal, extra, weight: weights[i] };
  });

  // Reconcile rounding drift on the largest line so Σ lines == invoice totals.
  const allocatedSum = round2(allocated.reduce((s, a) => s + a.extra, 0));
  const drift = round2(totalExtraCosts - allocatedSum);
  if (drift !== 0 && allocated.length > 0) {
    let maxIdx = 0;
    allocated.forEach((a, i) => {
      if (a.weight > allocated[maxIdx].weight) maxIdx = i;
    });
    allocated[maxIdx].extra = round2(allocated[maxIdx].extra + drift);
  }

  const resultLines: AllocatedPurchaseLine[] = allocated.map((a, i) => {
    const lineLandedTotal = round2(a.lineTotal + a.extra);
    const qty = lines[i].quantityImported;
    return {
      linePurchaseTotal: a.lineTotal,
      allocatedExtraCost: a.extra,
      allocatedLineLandedCostTotal: lineLandedTotal,
      allocatedUnitLandedCost: qty > 0 ? round4(lineLandedTotal / qty) : 0,
    };
  });

  return {
    productsSubtotalAmount,
    totalExtraCosts,
    totalLandedCostAmount: round2(productsSubtotalAmount + totalExtraCosts),
    lines: resultLines,
  };
}
