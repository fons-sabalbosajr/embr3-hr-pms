import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import maintenanceMiddleware from "./middleware/maintenanceMiddleware.js";
import compression from "compression";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "path";

// Import your routes
import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import dtrRoutes from "./routes/dtrRoutes.js";
import dtrLogRoutes from "./routes/dtrLogRoutes.js";
import dtrDataRoutes from "./routes/dtrDataRoutes.js";
import trainingRoutes from "./routes/trainingRoutes.js";
import employeeDocRoutes from "./routes/employeeDocRoutes.js";
import employeeSalaryRoutes from "./routes/employeeSalaryRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import deductionTypeRoutes from "./routes/deductionTypeRoutes.js";
import payslipRequestRoutes from "./routes/payslipRequestRoutes.js";
import dtrRequestRoutes from "./routes/dtrRequestRoutes.js";
import dtrGenerationLogRoutes from "./routes/dtrGenerationLogRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import localHolidayRoutes from "./routes/localHolidayRoutes.js";
import suspensionRoutes from "./routes/suspensionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import featureRoutes from "./routes/features.js";
import bugReportRoutes from "./routes/bugReportRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import demoEnforcement from "./middleware/demoEnforcement.js";

dotenv.config();
const app = express();

// Allow multiple client origins via comma-separated env
const originEnv = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || "";
const allowedOrigins = originEnv
  .split(",")
  .map((s) => (s && s.trim().replace(/\/$/, "")))
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
// Security and performance middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // keep simple unless you define CSP for your app
    // Allow images and other static assets to be requested cross-origin (e.g., front-end dev server at :5175)
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Serve user-uploaded assets (e.g., avatars) directly
// Place BEFORE maintenance middleware so avatars are always retrievable
const configuredUploads = process.env.AVATAR_UPLOAD_DIR;
let resolvedUploads = configuredUploads
  ? (path.isAbsolute(configuredUploads)
      ? configuredUploads
      : path.resolve(process.cwd(), configuredUploads))
  : path.resolve(process.cwd(), "server", "uploads");
// Normalize potential trailing slashes
resolvedUploads = resolvedUploads.replace(/[/\\]+$/, "");
app.use("/uploads", express.static(resolvedUploads));

// Server-side demo enforcement middleware (deny-list + optional global read-only).
// Placed before route mounting so it can intercept write requests early.
app.use(demoEnforcement);

// Apply maintenance middleware for most routes, but allow auth routes to pass so
// users can still login and verify during maintenance. Dev routes are not bypassed here.
app.use((req, res, next) => {
  const path = req.path || "";
  if (path.startsWith("/api/users")) return next();
  return maintenanceMiddleware(req, res, next);
});

// --- API Routes ---
app.use("/api/users", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dtr", dtrRoutes);
app.use("/api/dtrlogs", dtrLogRoutes);
app.use("/api/dtrlogs", dtrGenerationLogRoutes);
app.use("/api/dtrdatas", dtrDataRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/employee-docs", employeeDocRoutes);
app.use("/api/employee-salaries", employeeSalaryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/deduction-types", deductionTypeRoutes);
app.use("/api/payslip-requests", payslipRequestRoutes);
app.use("/api/dtr-requests", dtrRequestRoutes);
// Mount developer routes (protected via auth + role checks inside the routes/controllers)
app.use("/api/dev", devRoutes);
app.use("/api/local-holidays", localHolidayRoutes);
app.use("/api/suspensions", suspensionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/bug-report", bugReportRoutes);
app.use("/api/messages", messageRoutes);

// Basic health endpoint for platform probes
app.get("/healthz", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : dbState === 3 ? "disconnecting" : "disconnected";
  res.json({
    status: "ok",
    uptime: process.uptime(),
    pid: process.pid,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

export default app;
