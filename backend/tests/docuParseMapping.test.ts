import { mapDocuParseResponse } from "../src/services/invoiceParsing/docuParseInvoiceParsingService";

// Sample shape mirrors https://docuparseapi.com/docs (completed response).
describe("mapDocuParseResponse", () => {
  it("maps the documented completed response", () => {
    const parsed = mapDocuParseResponse({
      document_type: "invoice",
      document_number: "INV-12847181",
      merchant: "Office Depot",
      currency: "USD",
      subtotal: 42.0,
      tax: "3.50",
      total: "45.50",
      line_items: [
        { description: "Paper A4", quantity: 2, unit_price: 10.5 },
        { description: "Pens", qty: "4", price: "5.25" },
      ],
    });

    expect(parsed.provider).toBe("docuparse");
    expect(parsed.supplierName).toBe("Office Depot");
    expect(parsed.supplierInvoiceNumber).toBe("INV-12847181");
    expect(parsed.currency).toBe("USD");
    expect(parsed.productsSubtotalAmount).toBe(42);
    expect(parsed.lineItems).toEqual([
      { productName: "Paper A4", productCode: undefined, quantityImported: 2, unitPurchasePrice: 10.5 },
      { productName: "Pens", productCode: undefined, quantityImported: 4, unitPurchasePrice: 5.25 },
    ]);
  });

  it("parses money given as strings and falls back to invoice_id", () => {
    const parsed = mapDocuParseResponse({
      invoice_id: "SUP-9",
      merchant: "Acme",
      subtotal: "1,250.75",
    });
    expect(parsed.supplierInvoiceNumber).toBe("SUP-9");
    expect(parsed.productsSubtotalAmount).toBe(1250.75);
    expect(parsed.lineItems).toEqual([]);
  });

  it("skips line items without a usable name and defaults qty/price", () => {
    const parsed = mapDocuParseResponse({
      merchant: "Acme",
      items: [{ quantity: 3 }, { name: "Widget" }],
    });
    expect(parsed.lineItems).toEqual([
      { productName: "Widget", productCode: undefined, quantityImported: 1, unitPurchasePrice: 0 },
    ]);
  });
});
