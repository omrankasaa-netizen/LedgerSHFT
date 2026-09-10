import dotenv from "dotenv";
import path from "path";

dotenv.config();

/**
 * Centralised, validated access to environment variables.
 * JWT_SECRET has a dev fallback so the app boots locally, but it warns loudly.
 */
export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  invoiceParserProvider: process.env.INVOICE_PARSER_PROVIDER || "mock",
  // DocuParse provider settings (only used when INVOICE_PARSER_PROVIDER=docuparse)
  docuParseApiKey: process.env.DOCUPARSE_API_KEY || "",
  docuParseBaseUrl: process.env.DOCUPARSE_BASE_URL || "https://docuparseapi.com",
  docuParseTimeoutMs: Number(process.env.DOCUPARSE_TIMEOUT_MS || 60000),
  // Mindee provider settings (only used when INVOICE_PARSER_PROVIDER=mindee)
  mindeeApiKey: process.env.MINDEE_API_KEY || "",
  mindeeBaseUrl: process.env.MINDEE_BASE_URL || "https://api.mindee.net",
  adminEmail: process.env.ADMIN_EMAIL || "admin@ledgershift.local",
  adminPassword: process.env.ADMIN_PASSWORD || "admin12345",
  // Folder with the built frontend, served when present (single-service deploy).
  staticDir: process.env.STATIC_DIR || path.join(__dirname, "..", "public"),
  isProduction: process.env.NODE_ENV === "production",
};

if (!config.jwtSecret) {
  config.jwtSecret = "dev-only-insecure-secret";
  console.warn("[config] JWT_SECRET not set — using an insecure dev default. Set it in .env!");
}
if (!config.databaseUrl) {
  console.warn("[config] DATABASE_URL not set — database calls will fail until it is configured.");
}
