import { config } from "../../config";
import { MockInvoiceParsingService } from "./mockInvoiceParsingService";
import { DocuParseInvoiceParsingService } from "./docuParseInvoiceParsingService";
import { MindeeInvoiceParsingService } from "./mindeeInvoiceParsingService";
import { AzureDocIntelligenceParsingService } from "./azureDocIntelligenceParsingService";
import type { InvoiceParsingService } from "./types";

/**
 * Pick the parsing provider from config (INVOICE_PARSER_PROVIDER).
 * "mock" returns deterministic sample data; "docuparse", "mindee" and
 * "azure" call the real APIs using their respective env settings.
 */
export function createInvoiceParsingService(): InvoiceParsingService {
  switch (config.invoiceParserProvider) {
    case "docuparse":
      return new DocuParseInvoiceParsingService();
    case "mindee":
      return new MindeeInvoiceParsingService();
    case "azure":
      return new AzureDocIntelligenceParsingService();
    case "mock":
    default:
      return new MockInvoiceParsingService();
  }
}
