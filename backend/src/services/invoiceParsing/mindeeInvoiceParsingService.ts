import { config } from "../../config";
import { ApiError } from "../../middleware/errorHandler";
import type {
  InvoiceParsingService,
  ParsedInvoiceLineItem,
  ParsedPurchaseInvoice,
  UploadedDocument,
} from "./types";

/** Subset of the Mindee Invoice V4 prediction payload we rely on. */
interface MindeeValueField<T> {
  value?: T | null;
}

interface MindeeLineItem {
  product_code?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
}

export interface MindeeInvoicePrediction {
  supplier_name?: MindeeValueField<string>;
  invoice_number?: MindeeValueField<string>;
  date?: MindeeValueField<string>;
  total_net?: MindeeValueField<number>;
  locale?: { currency?: string | null };
  line_items?: MindeeLineItem[];
}

interface MindeePredictResponse {
  api_request?: { error?: { message?: string } };
  document?: { inference?: { prediction?: MindeeInvoicePrediction } };
}

function cleanText(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Map a Mindee Invoice V4 prediction to our provider-agnostic shape. Exported for tests. */
export function mapMindeeResponse(prediction: MindeeInvoicePrediction): ParsedPurchaseInvoice {
  return {
    supplierName: cleanText(prediction.supplier_name?.value),
    supplierInvoiceNumber: cleanText(prediction.invoice_number?.value),
    date: cleanText(prediction.date?.value),
    currency: cleanText(prediction.locale?.currency),
    // total_net is the pre-tax subtotal, matching the form's "products subtotal" field.
    productsSubtotalAmount: cleanNumber(prediction.total_net?.value),
    lineItems: (prediction.line_items ?? [])
      .map((item): ParsedInvoiceLineItem | null => {
        const productName = cleanText(item.description);
        if (!productName) return null;
        return {
          productName,
          productCode: cleanText(item.product_code),
          quantityImported: cleanNumber(item.quantity) ?? 1,
          unitPurchasePrice: cleanNumber(item.unit_price) ?? 0,
        };
      })
      .filter((item): item is ParsedInvoiceLineItem => item !== null),
    provider: "mindee",
  };
}

/**
 * Real parsing provider backed by Mindee's Invoice V4 API
 * (https://developers.mindee.com/docs/invoice-ocr).
 * Unlike DocuParse, the predict endpoint is synchronous: one POST returns
 * the extracted fields directly, so no polling is needed.
 */
export class MindeeInvoiceParsingService implements InvoiceParsingService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    if (!config.mindeeApiKey) {
      throw new ApiError(500, "MINDEE_API_KEY is not configured on the server");
    }
    this.baseUrl = config.mindeeBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.mindeeApiKey;
  }

  async parsePurchaseInvoice(file: UploadedDocument): Promise<ParsedPurchaseInvoice> {
    const form = new FormData();
    form.append("document", new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.originalName);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/products/mindee/invoices/v4/predict`, {
        method: "POST",
        headers: { Authorization: `Token ${this.apiKey}` },
        body: form,
      });
    } catch {
      throw new ApiError(502, "Could not reach the Mindee API");
    }

    const body = (await response.json().catch(() => null)) as MindeePredictResponse | null;
    if (!response.ok) {
      const message = body?.api_request?.error?.message;
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(403, message || "Mindee rejected the API key. Check MINDEE_API_KEY.");
      }
      if (response.status === 429) {
        throw new ApiError(429, "Mindee quota reached — check usage in your Mindee dashboard.");
      }
      throw new ApiError(502, message || `Mindee error (${response.status})`);
    }

    const prediction = body?.document?.inference?.prediction;
    if (!prediction) {
      throw new ApiError(422, "Mindee could not extract an invoice from this document");
    }
    return mapMindeeResponse(prediction);
  }
}
