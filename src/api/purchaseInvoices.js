// Purchase invoice ("Imports & Cost") endpoints of the LedgerShift backend.
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from "./backendClient";

export const listPurchaseInvoices = () => apiGet("/api/purchase-invoices");

export const getPurchaseInvoice = (id) => apiGet(`/api/purchase-invoices/${id}`);

export const createPurchaseInvoice = (data) => apiPost("/api/purchase-invoices", data);

export const updatePurchaseInvoice = (id, data) => apiPut(`/api/purchase-invoices/${id}`, data);

export const deletePurchaseInvoice = (id) => apiDelete(`/api/purchase-invoices/${id}`);

// Preview landed-cost allocation without saving (drives "Calculate landed cost").
export const previewLandedCost = (payload) =>
  apiPost("/api/purchase-invoices/preview-landed-cost", payload);

// Search imported line items by product code/name (drives "Pick from imports").
export const searchImportLineItems = (search = "") =>
  apiGet(`/api/purchase-invoice-line-items${search ? `?search=${encodeURIComponent(search)}` : ""}`);

// Beta: upload a supplier invoice PDF/image for AI parsing.
export const parsePurchaseInvoiceUpload = (file) =>
  apiUpload("/api/purchase-invoices/parse-upload", file);
