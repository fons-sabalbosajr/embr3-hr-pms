import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import maintenanceMiddleware from "./middleware/maintenanceMiddleware.js";
import compression from "compression";
import helmet from "helmet";

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

dotenv.config();
const app = express();

// Allow multiple client origins via comma-separated env
const originEnv = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || "";
const allowedOrigins = originEnv
  .split(",")
  .map((s) => s && s.trim())
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
  })
);
app.use(compression());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Apply maintenance middleware for most routes, but allow auth routes to pass so
// users can still login and verify during maintenance. Dev routes are not bypassed here.
app.use((req, res, next) => {
  const path = req.path || "";
  if (path.startsWith("/api/users")) return next();
  return maintenanceMiddleware(req, res, next);
});

// --- API Routes ---
app.use("/api/users", authRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/dtr", dtrRoutes);
app.use("/api/dtrlogs", dtrGenerationLogRoutes);
app.use("/api/dtrlogs", dtrLogRoutes);
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

export default app;
