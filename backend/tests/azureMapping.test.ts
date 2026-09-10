import { mapAzureInvoiceFields } from "../src/services/invoiceParsing/azureDocIntelligenceParsingService";

// Sample shape mirrors Azure prebuilt-invoice analyzeResult.documents[0].fields.
describe("mapAzureInvoiceFields", () => {
  it("maps a full prebuilt-invoice result", () => {
    const parsed = mapAzureInvoiceFields({
      VendorName: { valueString: "Office Depot" },
      InvoiceId: { valueString: "INV-12847181" },
      InvoiceDate: { valueDate: "2026-09-10" },
      CurrencyCode: { valueString: "USD" },
      SubTotal: { valueCurrency: { amount: 42.0, currencyCode: "USD" } },
      Items: {
        valueArray: [
          {
            valueObject: {
              Description: { valueString: "Paper A4" },
              ProductCode: { valueString: "P-A4" },
              Quantity: { valueNumber: 2 },
              UnitPrice: { valueCurrency: { amount: 10.5 } },
            },
          },
          {
            valueObject: {
              Description: { valueString: "Pens" },
              Quantity: { valueNumber: 4 },
              UnitPrice: { valueCurrency: { amount: 5.25 } },
            },
          },
        ],
      },
    });

    expect(parsed.provider).toBe("azure");
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

  it("falls back to content, defaults quantity/price, drops nameless items", () => {
    const parsed = mapAzureInvoiceFields({
      VendorName: { content: "  Acme  " },
      Items: {
        valueArray: [
          { valueObject: { Description: { content: "Widget" } } },
          { valueObject: { Quantity: { valueNumber: 3 } } },
        ],
      },
    });

    expect(parsed.supplierName).toBe("Acme");
    expect(parsed.supplierInvoiceNumber).toBeUndefined();
    expect(parsed.productsSubtotalAmount).toBeUndefined();
    expect(parsed.lineItems).toEqual([
      { productName: "Widget", productCode: undefined, quantityImported: 1, unitPurchasePrice: 0 },
    ]);
  });
});
