import { config } from "../../config";
import { MockInvoiceParsingService } from "./mockInvoiceParsingService";
import type { InvoiceParsingService } from "./types";

/**
 * Pick the parsing provider from config. When a real provider is added
 * (e.g. AzureInvoiceParsingService), register it here.
 */
export function createInvoiceParsingService(): InvoiceParsingService {
  switch (config.invoiceParserProvider) {
    case "mock":
    default:
      return new MockInvoiceParsingService();
  }
}
