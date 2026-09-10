import type {
  InvoiceParsingService,
  ParsedPurchaseInvoice,
  UploadedDocument,
} from "./types";

/**
 * Deterministic stand-in for a real OCR provider. Lets the whole upload →
 * review → confirm flow be built and demoed before choosing a vendor.
 */
export class MockInvoiceParsingService implements InvoiceParsingService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async parsePurchaseInvoice(file: UploadedDocument): Promise<ParsedPurchaseInvoice> {
    return {
      provider: "mock",
      supplierName: "Demo Textiles Trading Co.",
      supplierInvoiceNumber: "SUP-2026-1042",
      originCountry: "CN",
      date: new Date().toISOString().slice(0, 10),
      currency: "USD",
      freightAmount: 850,
      dutyAmount: 420,
      customsFeesAmount: 130,
      otherFeesAmount: 0,
      lineItems: [
        { productCode: "TSH-BLK-M", productName: "T-Shirt Basic Black M", quantityImported: 500, unitPurchasePrice: 1.85 },
        { productCode: "TSH-WHT-L", productName: "T-Shirt Basic White L", quantityImported: 800, unitPurchasePrice: 1.8 },
        { productCode: "CAP-RED", productName: "Baseball Cap Red", quantityImported: 1200, unitPurchasePrice: 0.95 },
      ],
    };
  }
}
