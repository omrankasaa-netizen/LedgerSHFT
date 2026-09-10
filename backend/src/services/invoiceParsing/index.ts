import { config } from "../../config";
import { MockInvoiceParsingService } from "./mockInvoiceParsingService";
import { DocuParseInvoiceParsingService } from "./docuParseInvoiceParsingService";
import { MindeeInvoiceParsingService } from "./mindeeInvoiceParsingService";
import type { InvoiceParsingService } from "./types";

/**
 * Pick the parsing provider from config (INVOICE_PARSER_PROVIDER).
 * "mock" returns deterministic sample data; "docuparse" and "mindee" call
 * the real APIs using their respective *_API_KEY / *_BASE_URL settings.
 */
export function createInvoiceParsingService(): InvoiceParsingService {
  switch (config.invoiceParserProvider) {
    case "docuparse":
      return new DocuParseInvoiceParsingService();
    case "mindee":
      return new MindeeInvoiceParsingService();
    case "mock":
    default:
      return new MockInvoiceParsingService();
  }
}
