// Self-hosted data layer — replaces the old Base44 SDK.
// `db` mirrors the shape pages were written against (db.entities.Customer.list()
// etc.), translating between the frontend's snake_case and the backend's
// camelCase REST API so the pages stay simple.

import { apiGet, apiPost, apiPut, apiPatch, apiDelete, setBackendToken, getBackendToken } from "./backendClient";

const dateOnly = (d) => (d ? String(d).slice(0, 10) : "");

// --- API → frontend (snake_case) mappers ---

function customerFromApi(c) {
  return {
    id: c.id, name: c.name, type: c.type, city: c.city,
    contact_person: c.contactPerson, phone: c.phone, email: c.email,
    notes: c.notes, created_at: c.createdAt,
  };
}

function partnerFromApi(p) {
  return {
    id: p.id, name: p.name, role: p.role, contact: p.contact,
    phone: p.phone, email: p.email,
    default_share_type: p.defaultShareType, default_share_value: p.defaultShareValue,
    created_at: p.createdAt,
  };
}

function lineFromApi(l) {
  return {
    id: l.id, invoice_id: l.invoiceId,
    product_name: l.productName, product_code: l.productCode,
    quantity: l.quantity, unit_price: l.unitPrice, unit_cost: l.unitCost,
    line_total: l.lineTotal, line_cost_total: l.lineCostTotal,
    purchase_invoice_line_item_id: l.purchaseInvoiceLineItemId,
  };
}

function paymentFromApi(p) {
  return {
    id: p.id, customer_id: p.customerId, invoice_id: p.invoiceId,
    date: dateOnly(p.date), currency: p.currency, amount: p.amount,
    method: p.method, reference: p.reference, notes: p.notes, created_at: p.createdAt,
  };
}

function invoiceFromApi(inv) {
  return {
    id: inv.id, invoice_number: inv.invoiceNumber,
    customer_id: inv.customerId, partner_id: inv.partnerId,
    date: dateOnly(inv.date), currency: inv.currency,
    subtotal_amount: inv.subtotalAmount, discount_amount: inv.discountAmount,
    tax_amount: inv.taxAmount, total_amount: inv.totalAmount,
    total_cost_amount: inv.totalCostAmount, gross_profit_amount: inv.grossProfitAmount,
    partner_share_amount: inv.partnerShareAmount,
    status: inv.status, notes: inv.notes, created_at: inv.createdAt,
    line_items: (inv.lineItems || []).map(lineFromApi),
    payments: (inv.payments || []).map(paymentFromApi),
  };
}

function userFromApi(u) {
  return { id: u.id, email: u.email, full_name: u.name, name: u.name, role: u.role, created_at: u.createdAt };
}

// --- frontend → API (camelCase) mappers ---

const str = (v) => (v === undefined || v === null || v === "" ? null : String(v));
const num = (v) => Number(v) || 0;

function customerToApi(f) {
  return {
    name: f.name, type: f.type, city: str(f.city),
    contactPerson: str(f.contact_person), phone: str(f.phone),
    email: str(f.email), notes: str(f.notes),
  };
}

function partnerToApi(f) {
  return {
    name: f.name, role: f.role, contact: str(f.contact), phone: str(f.phone),
    email: str(f.email), defaultShareType: f.default_share_type || "none",
    defaultShareValue: num(f.default_share_value),
  };
}

function lineToApi(l) {
  return {
    productName: l.product_name, productCode: str(l.product_code),
    quantity: num(l.quantity) || 1, unitPrice: num(l.unit_price), unitCost: num(l.unit_cost),
    purchaseInvoiceLineItemId: l.purchase_invoice_line_item_id || null,
  };
}

// Header fields the backend accepts; totals are recomputed server-side.
function invoiceToApi(header, lines) {
  return {
    invoiceNumber: str(header.invoice_number),
    customerId: header.customer_id,
    partnerId: header.partner_id || null,
    date: header.date,
    currency: header.currency || "USD",
    discountAmount: num(header.discount_amount),
    taxAmount: num(header.tax_amount),
    status: header.status || "Draft",
    notes: str(header.notes),
    lineItems: (lines || []).map(lineToApi),
  };
}

function paymentToApi(f) {
  return {
    customerId: f.customer_id, invoiceId: f.invoice_id || null,
    date: f.date, currency: f.currency || "USD", amount: num(f.amount),
    method: f.method || "cash", reference: str(f.reference), notes: str(f.notes),
  };
}

// --- entity API ---

function makeEntity(basePath, fromApi, toApi) {
  return {
    list: async () => (await apiGet(basePath)).map(fromApi),
    get: async (id) => fromApi(await apiGet(`${basePath}/${id}`)),
    create: async (form) => fromApi(await apiPost(basePath, toApi(form))),
    update: async (id, form) => fromApi(await apiPut(`${basePath}/${id}`, toApi(form))),
    delete: (id) => apiDelete(`${basePath}/${id}`),
  };
}

export const db = {
  entities: {
    Customer: makeEntity("/api/customers", customerFromApi, customerToApi),
    Partner: makeEntity("/api/partners", partnerFromApi, partnerToApi),
    Invoice: {
      list: async () => (await apiGet("/api/invoices")).map(invoiceFromApi),
      get: async (id) => invoiceFromApi(await apiGet(`/api/invoices/${id}`)),
      // Header + lines go in one request; the backend recomputes all totals.
      create: async (header, lines) => invoiceFromApi(await apiPost("/api/invoices", invoiceToApi(header, lines))),
      // Full replace needs lines; a {status}-only body becomes a PATCH.
      update: async (id, header, lines) => {
        if (lines === undefined && Object.keys(header).every((k) => k === "status")) {
          return invoiceFromApi(await apiPatch(`/api/invoices/${id}/status`, { status: header.status }));
        }
        return invoiceFromApi(await apiPut(`/api/invoices/${id}`, invoiceToApi(header, lines)));
      },
      delete: (id) => apiDelete(`/api/invoices/${id}`),
    },
    Payment: {
      list: async () => (await apiGet("/api/payments")).map(paymentFromApi),
      create: async (form) => paymentFromApi(await apiPost("/api/payments", paymentToApi(form))),
      delete: (id) => apiDelete(`/api/payments/${id}`),
    },
    User: {
      list: async () => (await apiGet("/api/users")).map(userFromApi),
    },
  },
  // Replaces base44.users.inviteUser: admin creates the account directly.
  users: {
    list: async () => (await apiGet("/api/users")).map(userFromApi),
    create: async (form) => userFromApi(await apiPost("/api/users", {
      email: form.email, name: form.name, password: form.password, role: form.role,
    })),
    remove: (id) => apiDelete(`/api/users/${id}`),
  },
  auth: {
    isAuthenticated: () => !!getBackendToken(),
    me: async () => userFromApi((await apiGet("/api/auth/me")).user),
    logout: () => setBackendToken(null),
  },
};
