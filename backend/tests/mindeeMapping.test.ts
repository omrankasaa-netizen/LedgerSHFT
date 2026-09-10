import { mapMindeeResponse } from "../src/services/invoiceParsing/mindeeInvoiceParsingService";

// Sample shape mirrors the Mindee Invoice V4 prediction payload.
describe("mapMindeeResponse", () => {
  it("maps a full Invoice V4 prediction", () => {
    const parsed = mapMindeeResponse({
      supplier_name: { value: "Office Depot" },
      invoice_number: { value: "INV-12847181" },
      date: { value: "2026-09-10" },
      total_net: { value: 42.0 },
      locale: { currency: "USD" },
      line_items: [
        { description: "Paper A4", product_code: "P-A4", quantity: 2, unit_price: 10.5 },
        { description: "Pens", quantity: 4, unit_price: 5.25 },
      ],
    });

    expect(parsed.provider).toBe("mindee");
    expect(parsed.supplierName).toBe("Office Depot");
    expect(parsed.supplierInvoiceNumber).toBe("INV-12847181");
    expect(parsed.date).toBe("2026-09-10");
    expect(parsed.currency).toBe("USD");
    expect(parsed.productsSubtotalAmount).toBe(42);
    expect(parsed.lineItems).toEqual([
      { productName: "Paper A4", productCode: "P-A4", quantityImported: 2, unitPurchasePrice: 10.5 },
      { productName: "Pens", productCode: undefined, quantityImported: 4, unitPurchasePrice: 5.25 },
    ]);
  });

  it("handles missing fields and drops nameless line items", () => {
    const parsed = mapMindeeResponse({
      supplier_name: { value: "  Acme  " },
      line_items: [
        { description: null, quantity: 3, unit_price: 1 },
        { description: "Widget" },
      ],
    });

    expect(parsed.supplierName).toBe("Acme");
    expect(parsed.supplierInvoiceNumber).toBeUndefined();
    expect(parsed.productsSubtotalAmount).toBeUndefined();
    expect(parsed.lineItems).toEqual([
      { productName: "Widget", productCode: undefined, quantityImported: 1, unitPurchasePrice: 0 },
    ]);
  });
});
