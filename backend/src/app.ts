import express from "express";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import authRouter from "./routes/auth";
import customersRouter from "./routes/customers";
import partnersRouter from "./routes/partners";
import invoicesRouter from "./routes/invoices";
import paymentsRouter from "./routes/payments";
import purchaseInvoicesRouter from "./routes/purchaseInvoices";
import purchaseInvoiceLineItemsRouter from "./routes/purchaseInvoiceLineItems";
import reportsRouter from "./routes/reports";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",") }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "ledgershift-backend" }));

  app.use("/api/auth", authRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/partners", partnersRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/purchase-invoices", purchaseInvoicesRouter);
  app.use("/api/purchase-invoice-line-items", purchaseInvoiceLineItemsRouter);
  app.use("/api/reports", reportsRouter);

  app.use(errorHandler);
  return app;
}
