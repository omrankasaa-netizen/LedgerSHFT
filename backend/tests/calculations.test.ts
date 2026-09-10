import {
  allocateLandedCosts,
  computeCustomerBalance,
  computeInvoiceTotals,
  computePartnerShare,
  computePartnerShareSummary,
  round2,
} from "../src/utils/calculations";

describe("allocateLandedCosts", () => {
  const extras = { freightAmount: 100, dutyAmount: 50, customsFeesAmount: 30, otherFeesAmount: 20 };

  it("allocates extra costs proportionally to line value", () => {
    const result = allocateLandedCosts(
      [
        { quantityImported: 100, unitPurchasePrice: 3 }, // $300
        { quantityImported: 100, unitPurchasePrice: 1 }, // $100
      ],
      extras,
      "value",
    );
    expect(result.totalExtraCosts).toBe(200);
    expect(result.productsSubtotalAmount).toBe(400);
    expect(result.totalLandedCostAmount).toBe(600);
    // 75% / 25% split of $200
    expect(result.lines[0].allocatedExtraCost).toBe(150);
    expect(result.lines[1].allocatedExtraCost).toBe(50);
    expect(result.lines[0].allocatedUnitLandedCost).toBe(4.5); // (300+150)/100
    expect(result.lines[1].allocatedUnitLandedCost).toBe(1.5);
  });

  it("allocates equally per unit with the quantity method", () => {
    const result = allocateLandedCosts(
      [
        { quantityImported: 300, unitPurchasePrice: 10 },
        { quantityImported: 100, unitPurchasePrice: 1 },
      ],
      { freightAmount: 40 },
      "quantity",
    );
    expect(result.lines[0].allocatedExtraCost).toBe(30);
    expect(result.lines[1].allocatedExtraCost).toBe(10);
  });

  it("falls back to quantity allocation when the subtotal is 0", () => {
    const result = allocateLandedCosts(
      [
        { quantityImported: 3, unitPurchasePrice: 0 },
        { quantityImported: 1, unitPurchasePrice: 0 },
      ],
      { freightAmount: 40 },
      "value",
    );
    expect(result.lines[0].allocatedExtraCost).toBe(30);
    expect(result.lines[1].allocatedExtraCost).toBe(10);
  });

  it("keeps line totals summing exactly to the landed total (drift goes to the largest line)", () => {
    const result = allocateLandedCosts(
      [
        { quantityImported: 1, unitPurchasePrice: 1 },
        { quantityImported: 1, unitPurchasePrice: 1 },
        { quantityImported: 1, unitPurchasePrice: 1 },
      ],
      { freightAmount: 100 }, // 33.33 / 33.33 / 33.33 + drift
    );
    const lineSum = round2(result.lines.reduce((s, l) => s + l.allocatedLineLandedCostTotal, 0));
    expect(lineSum).toBe(result.totalLandedCostAmount);
    expect(lineSum).toBe(103);
  });

  it("keeps 4-decimal precision on unit costs for thousands of small units", () => {
    const result = allocateLandedCosts(
      [{ quantityImported: 10000, unitPurchasePrice: 0.0173 }],
      { freightAmount: 25 },
    );
    expect(result.lines[0].allocatedUnitLandedCost).toBe(0.0198); // (173+25)/10000
  });

  it("handles zero extras and zero quantity safely", () => {
    const result = allocateLandedCosts([{ quantityImported: 0, unitPurchasePrice: 5 }], {});
    expect(result.totalExtraCosts).toBe(0);
    expect(result.lines[0].allocatedUnitLandedCost).toBe(0);
  });
});

describe("computeInvoiceTotals", () => {
  it("computes subtotal, total, cost and gross profit from lines", () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 10, unitPrice: 5, unitCost: 4.5 }, // landed cost from an import
        { quantity: 2, unitPrice: 20, unitCost: 12 },
      ],
      5, // discount
      3, // tax
    );
    expect(totals.subtotalAmount).toBe(90);
    expect(totals.totalAmount).toBe(88); // 90 - 5 + 3
    expect(totals.totalCostAmount).toBe(69); // 45 + 24
    expect(totals.grossProfitAmount).toBe(19);
    expect(totals.partnerShareAmount).toBe(0);
  });

  it("treats missing unit costs as zero", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPrice: 100 }]);
    expect(totals.totalCostAmount).toBe(0);
    expect(totals.grossProfitAmount).toBe(100);
  });

  it("never lets the total go below zero", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPrice: 10 }], 50, 0);
    expect(totals.totalAmount).toBe(0);
  });
});

describe("computePartnerShare", () => {
  it("percentage share of gross profit", () => {
    expect(computePartnerShare(200, { defaultShareType: "percentage", defaultShareValue: 25 })).toBe(50);
  });

  it("fixed share regardless of profit", () => {
    expect(computePartnerShare(200, { defaultShareType: "fixed_amount", defaultShareValue: 75 })).toBe(75);
  });

  it("no partner or none type means zero", () => {
    expect(computePartnerShare(200, null)).toBe(0);
    expect(computePartnerShare(200, { defaultShareType: "none", defaultShareValue: 50 })).toBe(0);
  });
});

describe("computeCustomerBalance", () => {
  it("sums invoiced and paid, never goes negative", () => {
    const balance = computeCustomerBalance(
      [{ totalAmount: 100 }, { totalAmount: 50 }],
      [{ amount: 120 }],
    );
    expect(balance).toEqual({ totalInvoiced: 150, totalPaid: 120, outstanding: 30 });
  });

  it("overpayment clamps outstanding to zero", () => {
    const balance = computeCustomerBalance([{ totalAmount: 100 }], [{ amount: 150 }]);
    expect(balance.outstanding).toBe(0);
  });
});

describe("computePartnerShareSummary", () => {
  it("pays the share proportionally to collected amounts", () => {
    const summary = computePartnerShareSummary(
      [
        { totalAmount: 100, partnerShareAmount: 20 },
        { totalAmount: 200, partnerShareAmount: 40 },
      ],
      new Map([
        ["inv1", 100], // fully collected
        ["inv2", 100], // half collected
      ]),
      ["inv1", "inv2"],
    );
    expect(summary.shareDue).toBe(60);
    expect(summary.sharePaid).toBe(40); // 20 * 100% + 40 * 50%
    expect(summary.remaining).toBe(20);
  });
});
