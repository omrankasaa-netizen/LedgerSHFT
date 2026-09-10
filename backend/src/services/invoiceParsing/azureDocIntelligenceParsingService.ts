import { config } from "../../config";
import { ApiError } from "../../middleware/errorHandler";
import type {
  InvoiceParsingService,
  ParsedInvoiceLineItem,
  ParsedPurchaseInvoice,
  UploadedDocument,
} from "./types";

/** Subset of the Azure Document Intelligence prebuilt-invoice payload we rely on. */
export interface AzureField {
  content?: string;
  valueString?: string;
  valueDate?: string;
  valueNumber?: number;
  valueCurrency?: { amount?: number; currencyCode?: string };
  valueArray?: AzureField[];
  valueObject?: Record<string, AzureField>;
}

interface AzureAnalyzeResponse {
  status?: "notStarted" | "running" | "succeeded" | "failed" | string;
  analyzeResult?: { documents?: { fields?: Record<string, AzureField> }[] };
  error?: { message?: string };
}

/** Free tier (F0) invoice analysis usually finishes in a few seconds. */
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

function text(field: AzureField | undefined): string | undefined {
  const value = field?.valueString ?? field?.content;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function money(field: AzureField | undefined): number | undefined {
  const amount = field?.valueCurrency?.amount ?? field?.valueNumber;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : undefined;
}

/** Map Azure prebuilt-invoice fields to our provider-agnostic shape. Exported for tests. */
export function mapAzureInvoiceFields(fields: Record<string, AzureField>): ParsedPurchaseInvoice {
  const items = fields.Items?.valueArray ?? [];
  return {
    supplierName: text(fields.VendorName),
    supplierInvoiceNumber: text(fields.InvoiceId),
    date: fields.InvoiceDate?.valueDate ?? text(fields.InvoiceDate),
    currency: fields.CurrencyCode?.valueCurrency?.currencyCode ?? text(fields.CurrencyCode),
    productsSubtotalAmount: money(fields.SubTotal),
    lineItems: items
      .map((item): ParsedInvoiceLineItem | null => {
        const obj = item.valueObject ?? {};
        const productName = text(obj.Description);
        if (!productName) return null;
        return {
          productName,
          productCode: text(obj.ProductCode),
          quantityImported: obj.Quantity?.valueNumber ?? 1,
          unitPurchasePrice: money(obj.UnitPrice) ?? 0,
        };
      })
      .filter((item): item is ParsedInvoiceLineItem => item !== null),
    provider: "azure",
  };
}

/**
 * Real parsing provider backed by Azure Document Intelligence's
 * prebuilt-invoice model (works on the free F0 tier, 500 pages/month).
 * Flow: POST the file to :analyze (returns 202 + Operation-Location),
 * then poll that URL until the analysis succeeds, fails, or times out.
 */
export class AzureDocIntelligenceParsingService implements InvoiceParsingService {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor() {
    if (!config.azureDocIntelKey || !config.azureDocIntelEndpoint) {
      throw new ApiError(
        500,
        "AZURE_DOC_INTEL_KEY and AZURE_DOC_INTEL_ENDPOINT are not configured on the server",
      );
    }
    this.endpoint = config.azureDocIntelEndpoint.replace(/\/+$/, "");
    this.apiKey = config.azureDocIntelKey;
  }

  async parsePurchaseInvoice(file: UploadedDocument): Promise<ParsedPurchaseInvoice> {
    const operationUrl = await this.startAnalysis(file);
    const result = await this.pollUntilDone(operationUrl);
    const fields = result.analyzeResult?.documents?.[0]?.fields;
    if (!fields) {
      throw new ApiError(422, "Azure could not detect an invoice in this document");
    }
    return mapAzureInvoiceFields(fields);
  }

  /** POST :analyze with the raw file bytes; returns the Operation-Location poll URL. */
  private async startAnalysis(file: UploadedDocument): Promise<string> {
    const url = `${this.endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Content-Type": file.mimeType || "application/octet-stream",
        },
        body: new Uint8Array(file.buffer),
      });
    } catch {
      throw new ApiError(502, "Could not reach the Azure Document Intelligence endpoint");
    }

    if (response.status !== 202) {
      const body = (await response.json().catch(() => null)) as AzureAnalyzeResponse | null;
      this.throwAzureError(response.status, body);
    }
    const operationUrl = response.headers.get("operation-location");
    if (!operationUrl) {
      throw new ApiError(502, "Azure did not return an operation URL");
    }
    return operationUrl;
  }

  /** Poll the operation URL until succeeded/failed or the timeout hits. */
  private async pollUntilDone(operationUrl: string): Promise<AzureAnalyzeResponse> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      let body: AzureAnalyzeResponse | null;
      try {
        const response = await fetch(operationUrl, {
          headers: { "Ocp-Apim-Subscription-Key": this.apiKey },
        });
        body = (await response.json().catch(() => null)) as AzureAnalyzeResponse | null;
        if (!response.ok) this.throwAzureError(response.status, body);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, "Lost contact with Azure while polling the analysis");
      }
      if (body?.status === "succeeded") return body;
      if (body?.status === "failed") {
        throw new ApiError(422, body.error?.message || "Azure invoice analysis failed");
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new ApiError(504, `Azure analysis timed out after ${POLL_TIMEOUT_MS}ms`);
  }

  /** Translate Azure HTTP errors into actionable ApiErrors. */
  private throwAzureError(status: number, body: AzureAnalyzeResponse | null): never {
    const message = body?.error?.message;
    if (status === 401 || status === 403) {
      throw new ApiError(403, message || "Azure rejected the API key. Check AZURE_DOC_INTEL_KEY.");
    }
    if (status === 429) {
      throw new ApiError(429, "Azure free-tier quota reached (500 pages/month or rate limit).");
    }
    throw new ApiError(502, message || `Azure Document Intelligence error (${status})`);
  }
}
