/**
 * Seed Bug Reports — populates known system bugs/issues for the developer dashboard.
 *
 * Usage:  node scripts/seedBugReports.js
 *
 * This script inserts known bugs that were discovered during the codebase audit.
 * It skips duplicates by checking the title field.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import BugReport from "../models/BugReport.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/embr3hrpms";

const BUGS = [
  // ─── CRITICAL ──────────────────────────────────────────────────────────
  {
    title: "[Critical] Hardcoded AES-256 Fallback Encryption Key",
    description: `Feature: Messaging / Security
File: server/utils/messageCrypto.js (lines 7-10)

The AES-256-GCM encryption key for messages falls back to a hardcoded dev key ("0123456789abcdef…") when the MESSAGE_ENCRYPTION_KEY environment variable is not set. If this env var is ever missing in production, all messages are encrypted with a well-known key, making encryption effectively useless. Anyone reading the source code can decrypt every message in the database.

Resolution: Remove the hardcoded fallback entirely. If MESSAGE_ENCRYPTION_KEY is not set, the server should refuse to start or disable the messaging feature with a clear error log.`,
    pageUrl: "server/utils/messageCrypto.js",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Critical] Google Service Account Private Key Stored on Disk",
    description: `Feature: Infrastructure / Security
File: server/config/hr-service-account.json

A full Google Cloud service account private key is stored as a plaintext JSON file in the server config directory. While it may be listed in .gitignore, storing raw credentials in the filesystem is risky. If the server is compromised, the attacker gets full GCP service account access.

Resolution: Inject the service account credentials via environment variables (e.g., GOOGLE_SERVICE_ACCOUNT_KEY as a base64-encoded JSON string) or use a cloud secrets manager. Remove the JSON file from the filesystem entirely.`,
    pageUrl: "server/config/hr-service-account.json",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Critical] React Hook Called Inside Regular Function (Rules of Hooks)",
    description: `Feature: Navigation / Home Page
File: front-end/src/pages/HomePage/HomePage.jsx (line ~505)

useDemoMode() (a React hook) is called inside getMenuItems(), which is a regular function — not a React component or custom hook. This violates the Rules of Hooks and will either crash at runtime or produce unpredictable behavior. Hooks must only be called at the top level of a component or another hook.

The same hook is also correctly called at the top level (line ~229), so the one inside getMenuItems() is both illegal and redundant.

Resolution: Remove the useDemoMode() call from getMenuItems() and pass the isDemoUser value as a parameter instead.`,
    pageUrl: "/",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },

  // ─── HIGH ──────────────────────────────────────────────────────────────
  {
    title: "[High] Public Employee Search Endpoints Expose Data Without Auth",
    description: `Feature: Employee Management / Security
File: server/routes/employeeRoutes.js (lines 30-31)

Two endpoints are exposed without any authentication:
• GET /public/search
• GET /public/by-emp-id/:empId

These return employee names, positions, and section/unit data. While intentionally public for the employee request portal, they can be enumerated by anyone on the internet, leaking organizational structure data.

Resolution: Add rate limiting per IP, require CAPTCHA for external access, or restrict to internal network/VPN only.`,
    pageUrl: "/employees",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[High] Public Training Endpoint Leaks Participant Data",
    description: `Feature: Training / Security
File: server/routes/trainingRoutes.js (line 17)

GET /public/by-employee/:empId is accessible without authentication and returns training details including all participants' names, positions, and employee IDs. This is a data exposure risk — anyone with a valid empId can enumerate all training participants.

Resolution: Remove sensitive participant fields from the public response, or require authentication for this endpoint.`,
    pageUrl: "/training",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[High] Bug Report Rate Limiter Resets on Restart & Leaks Memory",
    description: `Feature: Bug Reporting / Security
File: server/controllers/bugReportController.js (lines 5-8)

The rate limiter for the public bug-report endpoint uses a plain Map() in memory. Problems:
1. On every server restart or deploy, the rate limit resets, allowing unlimited reports.
2. The map grows without bounds — there is no cleanup of old entries, causing a slow memory leak in long-running processes.
3. In multi-instance deployments, each instance has its own limiter, effectively multiplying the allowed rate.

Resolution: Use Redis-backed rate limiting (e.g., express-rate-limit with redis store) or at minimum add a periodic cleanup of expired entries from the Map.`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[High] Message Drafts Stored in Plaintext localStorage",
    description: `Feature: Messaging
File: front-end/src/pages/Messaging/Messaging.jsx (lines 72-94)

Message drafts are persisted in localStorage as plaintext JSON, bypassing the secureStorage module used everywhere else for sensitive data. If messages contain confidential HR information (salary discussions, disciplinary actions, etc.), this leaves sensitive content accessible in the browser's storage without any encryption.

Resolution: Replace localStorage.getItem/setItem for drafts with secureStore/secureRetrieve from the secureStorage utility, or clear drafts on logout.`,
    pageUrl: "/messaging/inbox",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[High] Missing Database Indexes on 5 Frequently-Queried Models",
    description: `Feature: Database / Performance
Files affected:
• server/models/PayslipRequest.js — no indexes on employeeId, period, or status
• server/models/DTRRequest.js — no indexes on employeeId or createdAt
• server/models/DTRData.js — no indexes on DTR_Record_Name or DTR_Cut_Off
• server/models/Training.js — no index on participants.empId (searched per employee)
• server/models/EmployeeSalary.js — no index on employeeId despite frequent lookups

As the dataset grows, queries against these collections will degrade significantly. Missing indexes on primary lookup fields cause full collection scans, impacting response times.

Resolution: Add compound indexes on the most-queried fields for each model. Example:
  PayslipRequest: { employeeId: 1, period: 1 }, { status: 1 }
  DTRData: { DTR_Record_Name: 1 }, { DTR_Cut_Off: 1 }
  EmployeeSalary: { employeeId: 1 }`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },

  // ─── MEDIUM ────────────────────────────────────────────────────────────
  {
    title: "[Medium] 50+ Empty Catch Blocks Swallowing Errors Across Codebase",
    description: `Feature: All modules
Files (sample):
• server/controllers/trainingController.js (4 instances)
• server/controllers/employeeController.js (4 instances)
• server/controllers/authController.js (6+ instances)
• server/controllers/payslipRequestController.js (5 instances)
• server/controllers/employeeDocController.js (5 instances)
• front-end/src/context/AuthContext.jsx (2 instances)
• front-end/src/api/axiosInstance.js
• front-end/utils/secureStorage.js (6 instances)

Over 50 catch(e){} / catch(_){} blocks silently swallow errors with no logging. This makes debugging production issues extremely difficult — errors happen but leave no trace.

Resolution: Add at minimum console.warn() or a structured logger call in every catch block. For server-side code, use a logging library like Winston with log levels.`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] Messaging: typingTimerRef Not Cleared on Component Unmount",
    description: `Feature: Messaging
File: front-end/src/pages/Messaging/Messaging.jsx (lines 316-321)

typingTimerRef is set via setTimeout in handleTypingEmit() but is never cleared in the component's cleanup/unmount effect. If the user navigates away while a typing timer is pending, the callback fires on an unmounted component, potentially causing a React "state update on unmounted component" warning and wasted processing.

Resolution: Add clearTimeout(typingTimerRef.current) in the useEffect cleanup function that handles socket listeners.`,
    pageUrl: "/messaging/inbox",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] GenInfo.jsx: setInterval Polling Without Guaranteed Cleanup",
    description: `Feature: Employee Management
File: front-end/src/components/Employees/GeneralInfo/GenInfo.jsx (lines 157-167)

An interval with setInterval(..., 250) is created to poll loading state. There is no return () => clearInterval(unwatch) in all exit paths. If the component's dependencies change rapidly, multiple intervals can stack, causing performance degradation and potential stale-closure bugs where old intervals keep running alongside new ones.

Resolution: Ensure every code path that sets the interval also returns a cleanup function to clearInterval on unmount or dependency change.`,
    pageUrl: "/employees",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] Messaging: Stale Closures in Mount useEffect",
    description: `Feature: Messaging
File: front-end/src/pages/Messaging/Messaging.jsx (lines 148-153)

The mount effect calls fetchConversations() and openConversation(cid) with an empty dependency array []. But openConversation references activeConvId which may be stale in the closure. Additionally, fetchConversations and markRead are useCallback with empty deps but internally use axiosInstance which changes headers at runtime — if the token isn't set yet, the calls fail silently.

Resolution: Add the relevant dependencies to the useEffect array or use refs to avoid stale closures. Consider using an AbortController to cancel fetches on unmount.`,
    pageUrl: "/messaging/inbox",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] Messaging: N+1 Query Problem for Unread Counts",
    description: `Feature: Messaging / Performance
File: server/controllers/messageController.js (lines 50-57)

After fetching all conversations, the controller loops through each one and does await Message.countDocuments(...) for unread counts — one additional DB query per conversation. For a user with many conversations, this creates N additional database round-trips, significantly slowing the response.

Resolution: Replace the loop with a single MongoDB aggregation pipeline that computes unread counts for all conversations in one query:
  Message.aggregate([
    { $match: { conversationId: { $in: convIds }, readBy: { $ne: userId } } },
    { $group: { _id: "$conversationId", unread: { $sum: 1 } } }
  ])`,
    pageUrl: "/messaging/inbox",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] Notification Model Missing Indexes & Per-User Read Tracking",
    description: `Feature: Notifications
File: server/models/Notification.js

The Notification model has no indexes on type, hidden, or createdAt — common query fields. The model also lacks per-user read tracking; the hidden field acts as a global flag, meaning marking a notification "hidden" affects all users, not just the one who dismissed it.

Resolution: Add indexes on { type: 1 }, { createdAt: -1 }, and { hidden: 1 }. Implement per-user read tracking by either adding a readBy: [ObjectId] array field or a separate UserNotificationStatus collection.`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] DTR Process: Redundant Double-Sort of Employee List",
    description: `Feature: DTR Process / Performance
File: front-end/src/pages/DTR/components/DTRProcess/DTRProcess.jsx (lines 869-892)

The filter useEffect calls sortEmployees() on the data, then calls it again on the result: setFilteredEmployees(sortEmployees(data)). The data is already sorted by the initial sortEmployees() call. This redundant double-sort is unnecessary computation on potentially large employee lists (hundreds of employees).

Resolution: Remove the redundant sortEmployees() call — sort only once.`,
    pageUrl: "/dtr/process",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] DevSettings Component Is 4,200+ Lines — Maintainability Risk",
    description: `Feature: Settings / Maintainability
File: front-end/src/components/Settings/DevSettings/DevSettings.jsx

This single component file is over 4,200 lines with 80+ state variables, dozens of API calls, and multiple sub-features (audit logs, backup, demo mode, employees, bug reports, drive browser, maintenance, notifications, etc.). This creates:
1. Slow rendering — any state change re-renders the entire tree
2. Difficult debugging — finding the relevant code is time-consuming
3. Merge conflicts — multiple developers touching the same giant file

Resolution: Break into sub-components (e.g., AuditLogsPanel, BugReportsPanel, MaintenancePanel) with their own state. Use React.lazy() or dynamic imports for panels that aren't immediately visible.`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] HomePage: Missing AbortController in Fetch useEffects",
    description: `Feature: Home Page
File: front-end/src/pages/HomePage/HomePage.jsx (lines 127-144)

Several useEffect blocks fire async fetch calls with empty catch {} blocks. If the component unmounts before the fetch completes, the resolved state-setter fires on an unmounted component — a React warning. There are no cancelled flags or AbortController usage in these effects.

Resolution: Use AbortController in each useEffect's fetch call and abort in the cleanup function:
  useEffect(() => {
    const controller = new AbortController();
    fetchData({ signal: controller.signal });
    return () => controller.abort();
  }, []);`,
    pageUrl: "/",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Medium] DTR Process: fetchDtrLogsByRecord Missing from useEffect Dependencies",
    description: `Feature: DTR Process
File: front-end/src/pages/DTR/components/DTRProcess/DTRProcess.jsx (lines 939-945)

The useEffect calls fetchDtrLogsByRecord(selectedRecord, employees) but doesn't include fetchDtrLogsByRecord in its dependency array. If the function reference changes due to a re-render (because it's not wrapped in useCallback), the effect will not re-fire, leading to stale data being displayed.

Resolution: Either wrap fetchDtrLogsByRecord in useCallback with proper dependencies or add it to the useEffect dependency array. Alternatively, use the eslint-plugin-react-hooks "exhaustive-deps" rule to catch these automatically.`,
    pageUrl: "/dtr/process",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },

  // ─── LOW ───────────────────────────────────────────────────────────────
  {
    title: "[Low] 30+ console.error/warn Calls Left in Production Code",
    description: `Feature: Across entire codebase

Over 30 console.error() and console.warn() calls are scattered throughout components and controllers. These:
1. Leak internal implementation details in the browser console
2. Are not structured or filterable
3. May expose sensitive variable contents

Resolution: Replace with a proper logging infrastructure — Winston or Pino on the server, a configurable log-level library on the client that can be silenced in production builds.`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] DTR Date Parsing: Fragile String Matching for Date Ranges",
    description: `Feature: DTR Process
File: front-end/src/pages/DTR/components/DTRProcess/DTRProcess.jsx (lines 924-935)

The dtrDays memo uses recordName.includes("1-15") and recordName.includes("16-") for string matching to determine which half of the month is being processed. This is fragile — a record named "Report 1-15 Summary" or any non-standard naming convention could match incorrectly, silently producing wrong day ranges.

Resolution: Use a more robust parsing approach — extract the date range with a regex pattern like /(\d{1,2})-(\d{1,2})/ or store the date range as structured data (startDay/endDay fields) rather than parsing it from the name.`,
    pageUrl: "/dtr/process",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] Payslip docNo Computation Has Race Condition",
    description: `Feature: Payslip Processing
File: server/controllers/payslipRequestController.js (lines 290-310)

When creating a new EmployeeDoc for a payslip, the docNo is computed by counting existing documents and adding 1. If two payslips are processed concurrently (e.g., in parallel API calls), they can both get the same count, resulting in duplicate docNo values.

Resolution: Use an atomic counter with findOneAndUpdate and $inc, or use a MongoDB sequence collection to generate guaranteed-unique sequential IDs.`,
    pageUrl: "/payslip",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] Settings Controller Silently Swallows Cache Errors",
    description: `Feature: Settings
File: server/controllers/settingsController.js (line ~103)

try { setSettings(settings); } catch(_) {} silently ignores cache-write failures. If the settings cache fails consistently, every subsequent request hits the database, causing unnecessary load with no visibility into the problem.

Resolution: Add console.warn("Settings cache write failed:", err) in the catch block to surface the issue in logs.`,
    pageUrl: "/settings/developer",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] DTRProcess Component Has 30+ useState Calls — Excessive Re-render Surface",
    description: `Feature: DTR Process / Performance
File: front-end/src/pages/DTR/components/DTRProcess/DTRProcess.jsx

This 1,700+ line component holds enormous state (~30+ useState calls). Many pieces of state (employee filters, DTR records, training data, holiday data, etc.) are unrelated but tightly coupled in one component. Any single state change triggers re-evaluation of all effects and memos, impacting rendering performance.

Resolution: Break into smaller sub-components (e.g., DTRFilters, DTRTable, DTRRecordSelector). Use React context for shared state or consider useReducer for related state groups.`,
    pageUrl: "/dtr/process",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] AuthContext Writes User Data Back to localStorage Despite Session Intent",
    description: `Feature: Authentication
File: front-end/src/context/AuthContext.jsx (line ~68)

The auth migration logic reads from secureGet (localStorage), copies to secureSessionStore (sessionStorage), then deletes from localStorage — establishing session-only intent. However, in the onAvatarUpdated handler, the updated user is written back to secureStore (localStorage) instead of secureSessionStore. This undoes the session-only intent and potentially leaves user data in localStorage after logout.

Resolution: Change the onAvatarUpdated handler to use secureSessionStore instead of secureStore.`,
    pageUrl: "/settings",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] PieChartComponent: Resize Event Listener Without Debounce",
    description: `Feature: Dashboard
File: front-end/src/components/Dashboard/component/PieChart/PieChartComponent.jsx (line ~132)

A window.addEventListener("resize", onResize) fires on every resize event without debouncing or throttling. Rapid window resizing (common during drag-to-resize) triggers costly chart re-renders on every animation frame, potentially causing jank.

Resolution: Wrap the onResize handler in a debounce function (e.g., lodash.debounce or a custom 150ms debounce) to batch rapid resize events.`,
    pageUrl: "/dashboard",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
  {
    title: "[Low] OnlineUsers: Forced Re-render Every 60 Seconds for Last-Seen Text",
    description: `Feature: Dashboard
File: front-end/src/components/Dashboard/component/OnlineUsers.jsx (lines 106-120)

An interval runs every 60 seconds to update "last seen" text for all offline users by calling setUsers() with a mapped array. This forces a re-render of the entire online users list every minute — even when nothing has actually changed (if all times still round to the same "X min ago" text).

Resolution: Only call setUsers if any displayed text actually changed. Compare the new mapped array with the current one before triggering the update, or move the relative-time formatting to render-time so the underlying data doesn't change.`,
    pageUrl: "/dashboard",
    reporterName: "System Audit",
    reporterEmail: "dev@embr3hr.com",
    status: "open",
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    let inserted = 0;
    let skipped = 0;

    for (const bug of BUGS) {
      const exists = await BugReport.findOne({ title: bug.title });
      if (exists) {
        skipped++;
        continue;
      }
      await BugReport.create(bug);
      inserted++;
    }

    console.log(`\nDone! Inserted ${inserted} bug reports, skipped ${skipped} duplicates.`);
    console.log(`Total bug reports in DB: ${await BugReport.countDocuments()}`);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seed();
