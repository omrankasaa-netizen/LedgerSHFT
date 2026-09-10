import { config } from "../../config";
import { MockInvoiceParsingService } from "./mockInvoiceParsingService";
import { DocuParseInvoiceParsingService } from "./docuParseInvoiceParsingService";
import type { InvoiceParsingService } from "./types";

/**
 * Pick the parsing provider from config (INVOICE_PARSER_PROVIDER).
 * "mock" returns deterministic sample data; "docuparse" calls the real
 * DocuParse API using DOCUPARSE_API_KEY / DOCUPARSE_BASE_URL.
 */
export function createInvoiceParsingService(): InvoiceParsingService {
  switch (config.invoiceParserProvider) {
    case "docuparse":
      return new DocuParseInvoiceParsingService();
    case "mock":
    default:
      return new MockInvoiceParsingService();
  }
}
