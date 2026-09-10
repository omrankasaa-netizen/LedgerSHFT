import { config } from "../../config";
import { ApiError } from "../../middleware/errorHandler";
import type {
  InvoiceParsingService,
  ParsedInvoiceLineItem,
  ParsedPurchaseInvoice,
  UploadedDocument,
} from "./types";

/** Subset of the DocuParse API payloads we rely on (https://docuparseapi.com/docs). */
interface DocuParseError {
  code: string;
  message: string;
}

interface DocuParseExtractResponse {
  success: boolean;
  document_id?: string;
  status?: "queued" | "processing" | "completed" | "failed";
  message?: string;
  error?: DocuParseError;
  data?: Record<string, unknown>;
}

/** DocuParse returns money fields inconsistently (42.0 vs "45.50"); normalise both. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.,-]/g, "").replace(",", ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Extract a line-item array from whatever key the extractor used. */
function findRawLineItems(data: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["line_items", "lineItems", "items"]) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter((v) => v && typeof v === "object");
  }
  return [];
}

/** Map one raw DocuParse line item to our shape; returns null if it has no usable name. */
function mapLineItem(raw: Record<string, unknown>): ParsedInvoiceLineItem | null {
  const productName =
    toText(raw.description) ?? toText(raw.name) ?? toText(raw.product) ?? toText(raw.item);
  if (!productName) return null;
  return {
    productName,
    productCode: toText(raw.sku) ?? toText(raw.code),
    quantityImported: toNumber(raw.quantity) ?? toNumber(raw.qty) ?? 1,
    unitPurchasePrice: toNumber(raw.unit_price) ?? toNumber(raw.price) ?? toNumber(raw.unitPrice) ?? 0,
  };
}

/** Map a completed DocuParse payload to our provider-agnostic shape. Exported for tests. */
export function mapDocuParseResponse(data: Record<string, unknown>): ParsedPurchaseInvoice {
  return {
    supplierName: toText(data.merchant) ?? toText(data.vendor) ?? toText(data.supplier),
    supplierInvoiceNumber: toText(data.document_number) ?? toText(data.invoice_id),
    date: toText(data.date),
    currency: toText(data.currency),
    productsSubtotalAmount: toNumber(data.subtotal),
    lineItems: findRawLineItems(data)
      .map(mapLineItem)
      .filter((item): item is ParsedInvoiceLineItem => item !== null),
    provider: "docuparse",
  };
}

/**
 * Real parsing provider backed by DocuParse (https://docuparseapi.com).
 * Uploads the document, then polls the document endpoint until extraction
 * completes, fails, or DOCUPARSE_TIMEOUT_MS elapses.
 */
export class DocuParseInvoiceParsingService implements InvoiceParsingService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor() {
    if (!config.docuParseApiKey) {
      throw new ApiError(500, "DOCUPARSE_API_KEY is not configured on the server");
    }
    this.baseUrl = config.docuParseBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.docuParseApiKey;
    this.timeoutMs = config.docuParseTimeoutMs;
  }

  async parsePurchaseInvoice(file: UploadedDocument): Promise<ParsedPurchaseInvoice> {
    const documentId = await this.upload(file);
    const data = await this.pollUntilDone(documentId);
    return mapDocuParseResponse(data);
  }

  /** POST /api/v1/extract — queue the document and return its document_id. */
  private async upload(file: UploadedDocument): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.originalName);

    const response = await this.fetchJson(`${this.baseUrl}/api/v1/extract`, {
      method: "POST",
      body: form,
    });
    if (!response.document_id) {
      throw new ApiError(502, "DocuParse did not return a document id");
    }
    return response.document_id;
  }

  /** Poll GET /api/v1/documents/:id until completed/failed or the timeout hits. */
  private async pollUntilDone(documentId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + this.timeoutMs;
    // Poll every 2s; DocuParse extractions typically finish in a few seconds.
    while (Date.now() < deadline) {
      const response = await this.fetchJson(`${this.baseUrl}/api/v1/documents/${documentId}`, {
        method: "GET",
      });
      if (response.status === "completed" && response.data) return response.data;
      if (response.status === "failed") {
        throw new ApiError(422, response.error?.message || "DocuParse extraction failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new ApiError(504, `DocuParse extraction timed out after ${this.timeoutMs}ms`);
  }

  /** fetch wrapper: Bearer auth + structured DocuParse errors → ApiError. */
  private async fetchJson(url: string, init: RequestInit): Promise<DocuParseExtractResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    } catch {
      throw new ApiError(502, "Could not reach DocuParse API");
    }

    const body = (await response.json().catch(() => null)) as DocuParseExtractResponse | null;
    if (!body) throw new ApiError(502, `DocuParse returned a non-JSON response (${response.status})`);
    if (!body.success) {
      const status = response.status >= 400 && response.status < 600 ? response.status : 502;
      throw new ApiError(status, body.error?.message || `DocuParse error (${response.status})`);
    }
    return body;
  }
}
