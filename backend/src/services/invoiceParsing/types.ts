/**
 * Pluggable invoice-OCR contract.
 * Implementations turn an uploaded supplier/customs document (PDF or image)
 * into structured header fields + line items. Add real providers (Azure
 * Document Intelligence, Google Document AI, ...) next to the mock and select
 * them via the INVOICE_PARSER_PROVIDER env var.
 */

export interface UploadedDocument {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface ParsedInvoiceLineItem {
  productCode?: string;
  productName: string;
  quantityImported: number;
  unitPurchasePrice: number;
}

export interface ParsedPurchaseInvoice {
  supplierName?: string;
  supplierInvoiceNumber?: string;
  originCountry?: string;
  date?: string; // YYYY-MM-DD
  currency?: string;
  productsSubtotalAmount?: number;
  freightAmount?: number;
  dutyAmount?: number;
  customsFeesAmount?: number;
  otherFeesAmount?: number;
  lineItems: ParsedInvoiceLineItem[];
  /** Provider name, so the UI can show where the data came from. */
  provider: string;
}

export interface InvoiceParsingService {
  parsePurchaseInvoice(file: UploadedDocument): Promise<ParsedPurchaseInvoice>;
}
