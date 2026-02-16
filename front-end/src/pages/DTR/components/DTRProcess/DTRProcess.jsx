import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useLocation } from "react-router-dom";
import {
  Typography,
  Spin,
  Space,
  Button,
  Dropdown,
  Menu,
  Tag,
  Badge,
  Tooltip,
} from "antd";
import {
  EyeOutlined,
  PrinterOutlined,
  MenuOutlined,
  ExclamationCircleOutlined,
  UndoOutlined,
  PlusSquareOutlined,
} from "@ant-design/icons";
import DTRFilters from "../DTRProcess/components/DTRFilters";
import DTRTable from "../DTRProcess/components/DTRTable";
import PrinterTrayDrawer from "../DTRProcess/components/DTRTrayDrawer";
import ViewDTR from "../ViewDTR/ViewDTR";
import DTRDayTiles from "../DTRProcess/components/DTRDayTiles";
import { fetchPhilippineHolidays } from "../../../../api/holidayPH";
import {
  generateDTRPdf,
  generateBatchDTRPdf,
} from "../../../../../utils/generateDTRpdf";
import { resolveTimePunches } from "../../../../../utils/resolveTimePunches";
import "./dtr.css";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import axiosInstance from "../../../../api/axiosInstance";
import axios from "axios";
import useLoading from "../../../../hooks/useLoading";
import { swalSuccess, swalError, swalWarning, swalInfo } from "../../../../utils/swalHelper";

const { Title } = Typography;

// Extend dayjs with the plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);
const LOCAL_TZ = "Asia/Manila";

const parseInLocalTz = (value) => {
  if (!value) return dayjs.invalid();
  if (dayjs.isDayjs && dayjs.isDayjs(value)) return value.tz(LOCAL_TZ);
  if (value instanceof Date || typeof value === "number")
    return dayjs(value).tz(LOCAL_TZ);
  const s = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
  return hasZone ? dayjs(s).tz(LOCAL_TZ) : dayjs.tz(s, LOCAL_TZ);
};

const isNonEmptyTimeString = (v) => {
  if (v == null) return false;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  if (s === "-" || s.toLowerCase() === "n/a") return false;
  const d = dayjs(s, ["hh:mm A", "h:mm A", "HH:mm", "H:mm"], true);
  return d.isValid();
};

const hasAnyPunches = (dayLogs) => {
  if (!dayLogs || typeof dayLogs !== "object") return false;
  for (const v of Object.values(dayLogs)) {
    if (Array.isArray(v)) {
      if (v.some(isNonEmptyTimeString)) return true;
    } else if (isNonEmptyTimeString(v)) {
      return true;
    }
  }
  return false;
};

// States mapping for tooltip labels
const STATE_LABELS = {
  // Common biometric states → normalized labels
  "C/In": "Time In",
  "Check In": "Time In",
  IN: "Time In",
  In: "Time In",
  "C/Out": "Time Out",
  "Check Out": "Time Out",
  OUT: "Time Out",
  Out: "Break Out",
  "Out Back": "Break In",
  "Break Out": "Break Out",
  "Break In": "Break In",
  // Overtime variants (kept separate so they don't overwrite main punches)
  "Overtime In": "OT In",
  "Overtime Out": "OT Out",
};

// (divisionAcronyms will be loaded from env below)

// Load acronyms from environment variables (Vite)
const parseEnvJson = (val, fallback = {}) => {
  try {
    if (!val || typeof val !== "string") return fallback;
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
};

const divisionAcronyms = parseEnvJson(
  import.meta.env.VITE_DIVISION_ACRONYMS,
  {},
);
const sectionUnitAcronymsFlat = parseEnvJson(
  import.meta.env.VITE_SECTION_OR_UNIT_ACRONYMS,
  {},
);
const positionAcronymsMap = parseEnvJson(
  import.meta.env.VITE_POSITION_ACRONYMS,
  {},
);
const divisionColors = {
  "Clearance and Permitting Division": "#1f9cca", // blue
  "Finance and Administrative Division": "#283539", // green
  "Environmental Monitoring and Enforcement Division": "#009d8c", // orange
  "Office of the Regional Director": "#cb330e", // pink/red
  "Specialized Team": "#fd8004",
};

// (sectionUnitAcronyms will be loaded from env as a flat map below)
// Helper: normalize position key lookup (env keys are uppercase in provided map)
const normalizePositionKey = (s) =>
  typeof s === "string" ? s.trim().toUpperCase() : "";

// Compute an acronym for a position title, with a few sensible rules and fallbacks
const computePositionAcronym = (position) => {
  if (!position || typeof position !== "string") return "";

  const raw = position.trim();

  const envHit = positionAcronymsMap[normalizePositionKey(raw)];
  if (envHit) return envHit;

  // Special-case Engineer roles → ENGR + rank (e.g., II)
  const upper = normalizePositionKey(raw);
  if (upper.startsWith("ENGINEER")) {
    const parts = raw.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const rank = /^(?:[IVXLCM]+|\d+)$/.test(last)
      ? ` ${last.toUpperCase()}`
      : "";
    return `ENGR${rank}`;
  }

  // Generic builder: take capital initials of significant words, keep trailing roman numeral/number
  const stopWords = new Set([
    "of",
    "and",
    "the",
    "unit",
    "section",
    "division",
  ]);
  const tokens = raw
    .replace(/[(),]/g, " ")
    .split(/[\s\-/]+/)
    .filter(Boolean);

  if (!tokens.length) return raw;

  // Detect trailing roman numerals or numbers as class/rank
  let rank = "";
  const last = tokens[tokens.length - 1];
  if (/^(?:[IVXLCM]+|\d+)$/.test(last)) {
    rank = last.toUpperCase();
    tokens.pop();
  }

  const letters = tokens
    .filter((t) => !stopWords.has(t.toLowerCase()))
    .map((t) => t[0]?.toUpperCase())
    .filter(Boolean)
    .join("");

  if (!letters) return rank || raw;
  return rank ? `${letters} ${rank}` : letters;
};

const DTRProcess = ({ currentUser }) => {
  const { withLoading } = useLoading();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [dtrLogsLoading, setDtrLogsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const [sectionOrUnitFilter, setSectionOrUnitFilter] = useState("");
  const [dtrLogs, setDtrLogs] = useState({});
  const [dtrRecords, setDtrRecords] = useState([]);
  const [selectedDtrRecord, setSelectedDtrRecord] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const containerRef = useRef(null);
  const [viewDTRVisible, setViewDTRVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [printerTray, setPrinterTray] = useState([]);
  const [holidaysPH, setHolidaysPH] = useState([]);
  const [localHolidays, setLocalHolidays] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [viewActionLoadingKey, setViewActionLoadingKey] = useState(null);
  const [trayActionLoadingKey, setTrayActionLoadingKey] = useState(null);
  const [employeeTrainings, setEmployeeTrainings] = useState({});
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const location = useLocation();

  const getEmployeeUiKey = (emp) =>
    emp?.stableKey || emp?._id || emp?.empId || emp?.empNo || emp?.name;

  const runRowAction = async (setter, key, fn) => {
    setter(key);
    try {
      await Promise.resolve(fn());
    } finally {
      // Small delay so the spinner is visible even for sync actions
      setTimeout(() => setter(null), 250);
    }
  };

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const res = await axiosInstance.get(`/employees`);
      const sortedData = sortEmployees(res.data).map((emp, idx) => ({
        ...emp,
        stableKey:
          emp._id || emp.empId || emp.empNo || `${emp.name || "emp"}__${idx}`,
      }));
      setEmployees(sortedData);
      setFilteredEmployees(sortedData);
      // Defer DTR logs loading until a record is selected to reduce initial load
      // Apply deep-link empId filter if present in query params
      const params = new URLSearchParams(location.search);
      const empIdParam = params.get("empId");
      if (empIdParam) {
        setSearchText(empIdParam);
        setFilteredEmployees(
          sortedData.filter((e) =>
            [e.empId, e.empNo, e.name, e.normalizedName]
              .filter(Boolean)
              .some((v) =>
                String(v).toLowerCase().includes(empIdParam.toLowerCase()),
              ),
          ),
        );
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      swalError("Unable to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchDtrLogs = async (employees) => {
    try {
      setDtrLogsLoading(true);

      // Keep query payload small: send only primary empIds. Server expands to alternateEmpIds.
      const employeeEmpIds = Array.from(
        new Set(
          employees
            .map((emp) => emp?.empId)
            .filter(Boolean)
            .map(String),
        ),
      );

      const startOfMonth = dayjs().startOf("month").format("YYYY-MM-DD");
      const endOfMonth = dayjs().endOf("month").format("YYYY-MM-DD");

      const res = await axiosInstance.get(`/dtrlogs/merged`, {
        params: {
          empIds: employeeEmpIds.join(","),
          startDate: startOfMonth,
          endDate: endOfMonth,
        },
      });
      const logsPayload = Array.isArray(res.data) ? res.data : res.data?.data;
      if (!logsPayload) {
        swalError("Failed to load DTR logs");
        return;
      }
      const logs = logsPayload;
      // Collect raw logs per employee+date
      const rawByEmpDay = {};
      logs.forEach((log) => {
        if (!log.empId) return;
        const empKey = log.empId;
        const dateKey = dayjs(log.time).tz(LOCAL_TZ).format("YYYY-MM-DD");
        if (!rawByEmpDay[empKey]) rawByEmpDay[empKey] = {};
        if (!rawByEmpDay[empKey][dateKey]) rawByEmpDay[empKey][dateKey] = [];
        rawByEmpDay[empKey][dateKey].push(log);
      });

      // Resolve using chronological position-based detection
      const logsByEmpDay = {};
      Object.entries(rawByEmpDay).forEach(([empKey, dates]) => {
        logsByEmpDay[empKey] = {};
        Object.entries(dates).forEach(([dateKey, dayLogs]) => {
          const resolved = resolveTimePunches(dayLogs, { format: "hh:mm A" });
          logsByEmpDay[empKey][dateKey] = {
            "Time In": resolved.timeIn || null,
            "Break Out": resolved.breakOut || null,
            "Break In": resolved.breakIn || null,
            "Time Out": resolved.timeOut || null,
          };
        });
      });

      setDtrLogs(logsByEmpDay);
    } catch (error) {
      console.error("Failed to fetch DTR logs:", error);
      swalError("Error loading DTR logs");
      setDtrLogs({});
    } finally {
      setDtrLogsLoading(false);
    }
  };

  // Fetch logs for a specific DTR record (handles pagination and robust candidate mapping)
  const fetchDtrLogsByRecord = async (selectedRecord, employees) => {
    try {
      setDtrLogsLoading(true);

      // Keep query payload small: send only primary empIds. Server expands to alternateEmpIds.
      const employeeEmpIds = Array.from(
        new Set(
          employees
            .map((emp) => emp?.empId)
            .filter(Boolean)
            .map(String),
        ),
      );

      // Always fetch by cut-off date range; recordName filter can be too strict for ad-hoc cut-off records.
      const cutStartParam = parseInLocalTz(
        selectedRecord?.DTR_Cut_Off?.start,
      ).format("YYYY-MM-DD");
      const cutEndParam = parseInLocalTz(
        selectedRecord?.DTR_Cut_Off?.end,
      ).format("YYYY-MM-DD");

      const fetchAllMergedLogs = async (baseParams) => {
        const limit = 500;
        let page = 1;
        let total = 0;
        let allLogs = [];
        while (true) {
          const res = await axiosInstance.get(`/dtrlogs/merged`, {
            params: {
              ...baseParams,
              page,
              limit,
            },
          });
          const payload = Array.isArray(res.data) ? res.data : res.data?.data;
          const metaTotal = res.data?.total || 0;
          total = Math.max(total, metaTotal);
          const batch = Array.isArray(payload) ? payload : [];
          allLogs = allLogs.concat(batch);
          if (batch.length < limit) break;
          if (allLogs.length >= total && total > 0) break;
          page += 1;
          if (page > 100) break; // safety guard
        }
        return { allLogs, total };
      };

      const commonParams = {
        empIds: employeeEmpIds.join(","),
        startDate: cutStartParam,
        endDate: cutEndParam,
      };

      // Attempt 1: include recordName (keeps behavior for logs tied to a DTR_ID)
      let { allLogs, total } = await fetchAllMergedLogs({
        ...commonParams,
        recordName: selectedRecord.DTR_Record_Name,
      });

      // Fallback: if recordName yields nothing, refetch without recordName (date-range-only)
      if ((!total || total === 0) && allLogs.length === 0) {
        ({ allLogs, total } = await fetchAllMergedLogs(commonParams));
      }

      let logsPayload = allLogs;
      if (!logsPayload) {
        swalError("Failed to load DTR logs");
        setDtrLogs({});
        return;
      }

      // Pre-filter logs to the selected record's cut-off window and to names matching our employees
      try {
        const cutStart = parseInLocalTz(
          selectedRecord.DTR_Cut_Off.start,
        ).startOf("day");
        const cutEnd = parseInLocalTz(selectedRecord.DTR_Cut_Off.end).endOf(
          "day",
        );

        const STOP_NAME_TOKENS = new Set([
          "de",
          "del",
          "dela",
          "la",
          "las",
          "los",
          "da",
          "dos",
          "das",
          "san",
          "sta",
          "sto",
          "mr",
          "ms",
          "mrs",
        ]);

        const normalizeTextLocal = (s) => {
          if (!s) return "";
          return String(s)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        };

        const empNameNorms = employees
          .map((e) => e.normalizedName || normalizeTextLocal(e.name || ""))
          .filter(Boolean);

        logsPayload = logsPayload.filter((log) => {
          // Filter by time within cut-off
          const t = dayjs.tz(log.time, LOCAL_TZ);
          if (!t.isValid()) return false;
          if (t.isBefore(cutStart) || t.isAfter(cutEnd)) return false;

          // If the log has a name, try to match any normalized employee name token (similar to /Sabalbosa/)
          const logName = normalizeTextLocal(log.name || log.Name || "");
          if (logName) {
            for (const en of empNameNorms) {
              if (!en) continue;
              if (logName.includes(en) || en.includes(logName)) return true;
              // fallback: match on any token (e.g., last name)
              const tokens = en.split(" ").filter(Boolean);
              for (const tk of tokens) {
                if (!tk) continue;
                if (tk.length < 3) continue;
                if (STOP_NAME_TOKENS.has(tk)) continue;
                if (logName.includes(tk)) return true;
              }
            }
          }

          // If no name match, still keep logs that contain numeric identifiers matching employees (AC-No, empNo, cardNo)
          const numeric = (v) =>
            v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "";
          const fields = [
            log.acNo,
            log["AC-No"],
            log["AC No"],
            log.empNo,
            log.cardNo,
            log.badge,
            log.userid,
            log.userId,
          ];
          for (const f of fields) {
            if (!f) continue;
            const nf = numeric(f);
            if (!nf) continue;
            for (const emp of employees) {
              if (!emp) continue;
              const cand = [
                emp.empId,
                ...(emp.alternateEmpIds || []),
                emp.empNo,
                emp.acNo,
                emp.cardNo,
                emp.badge,
              ]
                .filter(Boolean)
                .map(numeric);
              if (cand.includes(nf)) return true;
            }
          }

          return false;
        });
      } catch (e) {
        // Non-fatal: if anything goes wrong here, fall back to unfiltered payload
        console.warn("DTR pre-filter failed, using unfiltered logs:", e);
      }

      // Yield to the browser so the UI stays responsive during heavy processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      const logsByEmpDay = {};

      // Build robust client-side mapping from AC-No/name → empId
      const normalizeDigits = (v) =>
        v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "";
      const normalizeText = (s) => {
        if (!s) return "";
        let t = String(s).toLowerCase().trim();
        if (t.includes(",")) {
          const parts = t.split(",");
          const left = parts.shift().trim();
          const right = parts.join(" ").trim();
          t = (right + " " + left).trim();
        }
        t = t.replace(/\b(jr|sr|ii|iii|iv|jr\.|sr\.)\b/g, " ");
        t = t.replace(/[^a-z0-9\s]/g, " ");
        return t.replace(/\s+/g, " ").trim();
      };

      const empIdByCandidate = new Map();
      const empIdByNameNorm = new Map();
      // token -> Set(empId)
      const nameTokensMap = new Map();
      const empTokensMap = new Map();
      // digits -> Set(empId) for robust numeric/suffix matching
      const digitsToEmpIds = new Map();
      const addCandidate = (key, id) => {
        if (!key) return;
        const s = String(key);
        empIdByCandidate.set(s, id);
        const digits = normalizeDigits(s);
        if (digits) empIdByCandidate.set(digits, id);
        if (digits) {
          if (!digitsToEmpIds.has(digits))
            digitsToEmpIds.set(digits, new Set());
          digitsToEmpIds.get(digits).add(id);
        }
        const lowered = s.toLowerCase().trim();
        if (lowered) empIdByCandidate.set(lowered, id);
        const compact = lowered.replace(/\s+/g, "");
        if (compact) empIdByCandidate.set(compact, id);
      };

      employees.forEach((emp) => {
        if (!emp) return;
        const primaryEmpId = emp.empId;
        if (!primaryEmpId) return;
        const candidates = [
          emp.empId,
          emp.empNo,
          emp.acNo,
          emp.cardNo,
          emp.badge,
          ...(emp.alternateEmpIds || []),
        ]
          .filter(Boolean)
          .map(String);
        candidates.forEach((c) => addCandidate(c, primaryEmpId));

        // also add empId, empNo lowercased/no-spaces
        addCandidate(emp.empId, primaryEmpId);
        addCandidate(emp.empNo, primaryEmpId);

        const nameNorm = emp.normalizedName || normalizeText(emp.name);
        if (nameNorm) empIdByNameNorm.set(nameNorm, primaryEmpId);

        // Build token index for keyword matching
        const tokens = (nameNorm || "").split(/\s+/).filter(Boolean);
        empTokensMap.set(primaryEmpId, tokens);
        tokens.forEach((tk) => {
          if (!nameTokensMap.has(tk)) nameTokensMap.set(tk, new Set());
          nameTokensMap.get(tk).add(primaryEmpId);
        });
      });

      logsPayload.forEach((log) => {
        // Prefer server-resolved empId
        let empKey = log.empId || null;

        // Normalize helper for lookup: try raw, digits-only, lowercased, compact
        const tryLookup = (val) => {
          if (!val && val !== 0) return null;
          const s = String(val);
          let found = null;
          if (empIdByCandidate.has(s)) found = empIdByCandidate.get(s);
          const d = normalizeDigits(s);
          // exact digits match
          if (!found && d && digitsToEmpIds.has(d)) {
            const set = digitsToEmpIds.get(d);
            if (set.size === 1) found = Array.from(set)[0];
          }
          // suffix match: e.g., device prefix -> '31007' should match '1007'
          if (!found && d) {
            for (const [candDigits, idSet] of digitsToEmpIds.entries()) {
              if (!candDigits) continue;
              if (d.endsWith(candDigits)) {
                if (idSet.size === 1) {
                  found = Array.from(idSet)[0];
                  break;
                }
                // ambiguous: if multiple empIds share the same digits, skip
              }
            }
          }
          if (!found && d && empIdByCandidate.has(d))
            found = empIdByCandidate.get(d);
          const low = s.toLowerCase().trim();
          if (!found && empIdByCandidate.has(low))
            found = empIdByCandidate.get(low);
          const compact = low.replace(/\s+/g, "");
          if (!found && empIdByCandidate.has(compact))
            found = empIdByCandidate.get(compact);

          return found;
        };

        // Try common fields from the log object
        if (!empKey) {
          const tryFields = [
            "empId",
            "empNo",
            "acNo",
            "AC-No",
            "AC No",
            "cardNo",
            "badge",
            "userid",
            "userId",
          ];
          for (const f of tryFields) {
            if (log[f]) {
              const hit = tryLookup(log[f]);
              if (hit) {
                empKey = hit;
                break;
              }
            }
          }
        }

        // Fallback: match by normalized name (exact approximate)
        if (!empKey && log.name) {
          const ln = normalizeText(log.name);
          if (empIdByNameNorm.has(ln)) empKey = empIdByNameNorm.get(ln);
        }

        // If still unknown, attempt keyword/token-based matching using the name tokens
        if (!empKey && log.name) {
          const ln = normalizeText(log.name);
          const logTokens = (ln || "").split(/\s+/).filter(Boolean);
          const score = new Map();
          logTokens.forEach((tk) => {
            if (!tk) return;
            const set = nameTokensMap.get(tk);
            if (!set) return;
            set.forEach((eid) => {
              score.set(eid, (score.get(eid) || 0) + 1);
            });
          });

          if (score.size) {
            // pick best candidate + check if it's a clear winner
            let best = null;
            let bestCount = 0;
            let secondBestCount = 0;
            for (const [eid, cnt] of score.entries()) {
              if (cnt > bestCount) {
                secondBestCount = bestCount;
                best = eid;
                bestCount = cnt;
              } else if (cnt === bestCount) {
                // tie → prefer exact last-name match if present
                const eidTokens = empTokensMap.get(eid) || [];
                const bestTokens = empTokensMap.get(best) || [];
                const lastLog = logTokens[logTokens.length - 1];
                if (
                  lastLog &&
                  eidTokens.includes(lastLog) &&
                  !bestTokens.includes(lastLog)
                ) {
                  best = eid;
                }
                secondBestCount = Math.max(secondBestCount, cnt);
              } else if (cnt > secondBestCount) {
                secondBestCount = cnt;
              }
            }

            // Accept only if:
            // - at least 2 tokens match AND best is a clear winner, OR
            // - a unique long token maps to exactly one employee (high confidence)
            const hasUniqueLongToken = logTokens.some((t) => {
              if (!t || t.length < 4) return false;
              const set = nameTokensMap.get(t);
              return set && set.size === 1 && set.has(best);
            });

            if (
              best &&
              ((bestCount >= 2 && bestCount > secondBestCount) ||
                (bestCount === 1 && hasUniqueLongToken))
            ) {
              empKey = best;
            }
            // If the empKey is still ambiguous but the log contains numeric identifiers that map strongly, prefer numeric
            if (!empKey) {
              const numeric = (v) =>
                v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "";
              const fields = [
                log.acNo,
                log["AC-No"],
                log["AC No"],
                log.empNo,
                log.cardNo,
                log.badge,
                log.userid,
                log.userId,
              ];
              for (const f of fields) {
                if (!f) continue;
                const nf = numeric(f);
                if (!nf) continue;
                // exact digits or suffix matching
                if (digitsToEmpIds.has(nf)) {
                  const set = digitsToEmpIds.get(nf);
                  if (set.size === 1) {
                    empKey = Array.from(set)[0];
                    break;
                  }
                }
                for (const [candDigits, idSet] of digitsToEmpIds.entries()) {
                  if (!candDigits) continue;
                  if (nf.endsWith(candDigits) && idSet.size === 1) {
                    empKey = Array.from(idSet)[0];
                    break;
                  }
                }
                if (empKey) break;
              }
            }
          }
        }

        if (!empKey) return; // still unknown, skip

        const dateKey = dayjs(log.time).tz(LOCAL_TZ).format("YYYY-MM-DD");

        if (!logsByEmpDay[empKey]) logsByEmpDay[empKey] = {};
        if (!logsByEmpDay[empKey][dateKey]) {
          logsByEmpDay[empKey][dateKey] = {
            _rawLogs: [],
          };
        }

        // Collect raw log into the day bucket
        logsByEmpDay[empKey][dateKey]._rawLogs.push(log);
      });

      // Resolve each day using chronological position-based detection
      Object.keys(logsByEmpDay).forEach((empKey) => {
        Object.keys(logsByEmpDay[empKey]).forEach((dateKey) => {
          const dayObj = logsByEmpDay[empKey][dateKey];
          const rawLogs = dayObj._rawLogs || [];
          delete dayObj._rawLogs;

          const resolved = resolveTimePunches(rawLogs, {
            format: "hh:mm A",
            defaultBreak: false,
          });
          dayObj["Time In"] = resolved.timeIn ? [resolved.timeIn] : [];
          dayObj["Break Out"] = resolved.breakOut ? [resolved.breakOut] : [];
          dayObj["Break In"] = resolved.breakIn ? [resolved.breakIn] : [];
          dayObj["Time Out"] = resolved.timeOut ? [resolved.timeOut] : [];

          // Preserve OT punches (extracted by State since they're separate from normal punches)
          const otInLogs = rawLogs.filter((l) => {
            const st = l.state || l.State || "";
            return st === "Overtime In" || st === "OT In";
          });
          const otOutLogs = rawLogs.filter((l) => {
            const st = l.state || l.State || "";
            return st === "Overtime Out" || st === "OT Out";
          });
          dayObj["OT In"] = otInLogs.map((l) =>
            dayjs(l.time).tz(LOCAL_TZ).format("hh:mm A"),
          );
          dayObj["OT Out"] = otOutLogs.map((l) =>
            dayjs(l.time).tz(LOCAL_TZ).format("hh:mm A"),
          );
        });
      });

      setDtrLogs(logsByEmpDay);
    } catch (error) {
      console.error("Failed to fetch DTR logs (by record):", error);
      swalError("Error loading DTR logs for selected record");
      setDtrLogs({});
    } finally {
      setDtrLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchDtrRecords = async () => {
      try {
        const res = await axiosInstance.get(`/dtrdatas`);
        const list = Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data)
            ? res.data
            : [];
        setDtrRecords(list);
      } catch (err) {
        swalError("Unable to load DTR records");
        setDtrRecords([]);
      }
    };
    fetchDtrRecords();
  }, []);

  const sortEmployees = (data) => {
    return [...data].sort((a, b) => {
      const empTypeOrder = {
        "Contract of Service": 1,
        Regular: 2,
      };
      const typeA = empTypeOrder[a.empType] || 99;
      const typeB = empTypeOrder[b.empType] || 99;
      if (typeA !== typeB) return typeA - typeB;

      const numA = extractNumberFromEmpNo(a.empNo);
      const numB = extractNumberFromEmpNo(b.empNo);
      return numA - numB;
    });
  };

  const extractNumberFromEmpNo = (empNo) => {
    if (!empNo) return 0;
    const match = empNo.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  };

  useEffect(() => {
    let data = sortEmployees(employees);

    if (searchText) {
      data = data.filter(
        (emp) =>
          emp.name?.toLowerCase().includes(searchText.toLowerCase()) ||
          emp.empNo?.toLowerCase().includes(searchText.toLowerCase()) ||
          emp.empId?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    if (empTypeFilter) {
      data = data.filter((emp) => emp.empType === empTypeFilter);
    }

    if (sectionOrUnitFilter) {
      data = data.filter((emp) =>
        emp.sectionOrUnit
          ?.toLowerCase()
          .includes(sectionOrUnitFilter.toLowerCase()),
      );
    }

    setFilteredEmployees(sortEmployees(data));
  }, [searchText, empTypeFilter, sectionOrUnitFilter, employees]);

  const recordsSafe = Array.isArray(dtrRecords) ? dtrRecords : [];
  const selectedRecord = useMemo(
    () => recordsSafe.find((rec) => rec.DTR_Record_Name === selectedDtrRecord),
    [recordsSafe, selectedDtrRecord],
  );

  const dtrDays = useMemo(() => {
    if (
      !selectedRecord ||
      !selectedRecord.DTR_Cut_Off?.start ||
      !selectedRecord.DTR_Cut_Off?.end
    ) {
      return [];
    }
    const start = parseInLocalTz(selectedRecord.DTR_Cut_Off.start);
    const end = parseInLocalTz(selectedRecord.DTR_Cut_Off.end);

    if (!start.isValid() || !end.isValid()) {
      console.error(
        "Invalid DTR_Cut_Off dates:",
        selectedRecord.DTR_Cut_Off.start,
        selectedRecord.DTR_Cut_Off.end,
      );
      return [];
    }

    const recordName = selectedRecord.DTR_Record_Name || "";
    if (recordName.includes("1-15")) {
      return Array.from({ length: 15 }, (_, i) => i + 1);
    } else if (recordName.includes("16-")) {
      const endOfMonth = start.endOf("month").date();
      const numDays = endOfMonth - 16 + 1;
      return Array.from({ length: numDays }, (_, i) => i + 16);
    } else {
      const days = [];
      let curr = start.clone();
      while (curr.isSameOrBefore(end, "day")) {
        days.push(curr.date());
        curr = curr.add(1, "day");
      }
      return days;
    }
  }, [selectedRecord]);

  useEffect(() => {
    if (selectedRecord && employees.length) {
      fetchDtrLogsByRecord(selectedRecord, employees);
    } else {
      setDtrLogs({});
    }
  }, [selectedRecord, employees]);

  useEffect(() => {
    async function getHolidays() {
      if (
        selectedRecord &&
        selectedRecord.DTR_Cut_Off?.start &&
        selectedRecord.DTR_Cut_Off?.end
      ) {
        const start = parseInLocalTz(selectedRecord.DTR_Cut_Off.start);
        const end = parseInLocalTz(selectedRecord.DTR_Cut_Off.end);

        if (!start.isValid() || !end.isValid()) {
          setHolidaysPH([]);
          setLocalHolidays([]);
          setSuspensions([]);
          return;
        }

        const years = Array.from(new Set([start.year(), end.year()])).filter(
          (y) => Number.isFinite(y),
        );
        const yearHolidayLists = await Promise.all(
          years.map((y) => fetchPhilippineHolidays(y)),
        );

        const holidays = yearHolidayLists.flat();
        const filtered = holidays
          .filter((h) => {
            const hDate = parseInLocalTz(h.date);
            if (!hDate.isValid()) return false;
            return (
              hDate.isSameOrAfter(start, "day") &&
              hDate.isSameOrBefore(end, "day")
            );
          })
          .map((h) => ({
            date: parseInLocalTz(h.date).format("YYYY-MM-DD"),
            name: h.localName,
            type: h.type,
          }));
        setHolidaysPH(filtered);
        // Fetch local holidays and suspensions in the same window
        try {
          const [lh, ss] = await Promise.all([
            axiosInstance.get(`/local-holidays`, {
              params: {
                start: start.format("YYYY-MM-DD"),
                end: end.format("YYYY-MM-DD"),
              },
            }),
            axiosInstance.get(`/suspensions`, {
              params: {
                start: start.format("YYYY-MM-DD"),
                end: end.format("YYYY-MM-DD"),
              },
            }),
          ]);
          setLocalHolidays(
            (lh.data?.data || []).map((h) => ({
              date: parseInLocalTz(h.date).isValid()
                ? parseInLocalTz(h.date).format("YYYY-MM-DD")
                : dayjs(h.date).format("YYYY-MM-DD"),
              endDate: h.endDate
                ? parseInLocalTz(h.endDate).isValid()
                  ? parseInLocalTz(h.endDate).format("YYYY-MM-DD")
                  : dayjs(h.endDate).format("YYYY-MM-DD")
                : null,
              name: h.name,
              type: "Local Holiday",
              location: h.location,
              notes: h.notes,
            })),
          );
          setSuspensions(
            (ss.data?.data || []).map((s) => ({
              date: parseInLocalTz(s.date).isValid()
                ? parseInLocalTz(s.date).format("YYYY-MM-DD")
                : dayjs(s.date).format("YYYY-MM-DD"),
              endDate: s.endDate
                ? parseInLocalTz(s.endDate).isValid()
                  ? parseInLocalTz(s.endDate).format("YYYY-MM-DD")
                  : dayjs(s.endDate).format("YYYY-MM-DD")
                : null,
              name: s.title,
              type: "Suspension",
              scope: s.scope,
              location: s.location,
              referenceType: s.referenceType,
              referenceNo: s.referenceNo,
              notes: s.notes,
            })),
          );
        } catch (e) {
          // Non-fatal
        }
      } else {
        setHolidaysPH([]);
        setLocalHolidays([]);
        setSuspensions([]);
      }
    }
    getHolidays();
  }, [selectedRecord]);

  useEffect(() => {
    async function fetchTrainingsBulk() {
      if (!employees.length || !selectedRecord) {
        setEmployeeTrainings({});
        return;
      }
      try {
        setTrainingLoading(true);
        const start = dayjs(selectedRecord.DTR_Cut_Off.start).format(
          "YYYY-MM-DD",
        );
        const end = dayjs(selectedRecord.DTR_Cut_Off.end).format("YYYY-MM-DD");
        const res = await axiosInstance.get(`/trainings`, {
          params: { start, end },
        });
        const list = Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data)
            ? res.data
            : [];

        // Filter to trainings overlapping the selected cut-off
        const startD = dayjs(selectedRecord.DTR_Cut_Off.start);
        const endD = dayjs(selectedRecord.DTR_Cut_Off.end);

        const inRange = list.filter((t) => {
          const s = dayjs(t?.trainingDate?.[0]);
          const e = dayjs(t?.trainingDate?.[1]);
          if (!s.isValid() || !e.isValid()) return false;
          return (
            s.isSameOrBefore(endD, "day") && e.isSameOrAfter(startD, "day")
          );
        });

        // Map per employee
        const empSet = new Set(employees.map((e) => e.empId).filter(Boolean));
        const map = {};
        inRange.forEach((t) => {
          const parts = Array.isArray(t.participants) ? t.participants : [];
          parts.forEach((p) => {
            if (!p?.empId) return;
            if (!empSet.has(p.empId)) return;
            if (!map[p.empId]) map[p.empId] = [];
            map[p.empId].push(t);
          });
        });

        setEmployeeTrainings(map);
      } catch (_) {
        setEmployeeTrainings({});
      } finally {
        setTrainingLoading(false);
      }
    }
    fetchTrainingsBulk();
  }, [employees, selectedRecord]);

  const hasAnyDTRLogs = (emp, dtrDays, dtrLogs, selectedRecord) => {
    const ids = [emp?.empId, ...(emp?.alternateEmpIds || [])]
      .filter(Boolean)
      .map(String);
    if (!ids.length) return false;

    return dtrDays.some((dayNum) => {
      const cutStart = parseInLocalTz(selectedRecord?.DTR_Cut_Off?.start);
      if (!cutStart.isValid()) return false;
      const dateKey = cutStart.clone().date(dayNum).format("YYYY-MM-DD");
      for (const id of ids) {
        const dayLogs = dtrLogs?.[id]?.[dateKey];
        if (hasAnyPunches(dayLogs)) return true;
      }
      return false;
    });
  };

  // Memoize the list of employees with missing DTR to avoid O(n×m) on every render
  const missingDtrEmployees = useMemo(() => {
    if (!selectedRecord || !dtrDays.length) return [];
    return employees.filter(
      (emp) => !hasAnyDTRLogs(emp, dtrDays, dtrLogs, selectedRecord),
    );
  }, [employees, dtrDays, dtrLogs, selectedRecord]);

  // Memoize combined holidays to avoid creating new arrays on every render
  const allHolidays = useMemo(
    () => [...holidaysPH, ...localHolidays, ...suspensions],
    [holidaysPH, localHolidays, suspensions],
  );

  const dtrHeaderTitle = useMemo(() => {
    if (
      selectedRecord &&
      selectedRecord.DTR_Cut_Off?.start &&
      selectedRecord.DTR_Cut_Off?.end
    ) {
      const start = dayjs(selectedRecord.DTR_Cut_Off.start);
      const end = dayjs(selectedRecord.DTR_Cut_Off.end);

      if (start.isValid() && end.isValid()) {
        const monthName = start.format("MMMM");
        const startDay = start.date();
        const endDay = end.date();

        return `Daily Time Record (${monthName} ${startDay}-${endDay} Cut Off)`;
      }
    }
    return "Daily Time Record";
  }, [selectedRecord]);

  const handleViewDTR = (employee) => {
    setSelectedEmployee(employee);
    setViewDTRVisible(true);
  };

  const logDTRRecord = async (employee, selectedRecord, currentUser) => {
    if (!employee?.empId || !selectedRecord) return;

    const cutOff = `${dayjs(selectedRecord.DTR_Cut_Off.start).format(
      "MMMM DD, YYYY",
    )}-${dayjs(selectedRecord.DTR_Cut_Off.end).format("MMMM DD, YYYY")}`;

    const payload = {
      empId: employee.empId,
      docType: "DTR",
      reference: selectedRecord.DTR_Record_Name || "DTR Record",
      period: cutOff,
      description: `DTR for ${cutOff}`,
      createdBy: currentUser?.name || "HR",
      dateIssued: new Date(),
    };

    try {
      const existingRes = await axiosInstance.get(
        `/employee-docs/by-employee/${employee.empId}`,
      );

      const existingDocs = existingRes.data?.data || [];

      const isDuplicate = existingDocs.some(
        (doc) =>
          doc.docType === payload.docType &&
          doc.reference === payload.reference &&
          doc.period === payload.period,
      );

      if (isDuplicate) {
        return;
      }

      const res = await axiosInstance.post("/employee-docs", payload);

      if (res.data?.success) {
      } else {
        console.error("Failed to log DTR record:", res.data);
      }
    } catch (err) {
      console.error(
        "Failed to log DTR record:",
        err.response?.data || err.message,
      );
    }
  };

  const handleViewDTRPdf = (item) => {
    generateDTRPdf(item);
  };

  const handleDownloadDTR = async (item) => {
    if (!item || !item.employee || !item.selectedRecord) return;

    await withLoading(async ({ updateProgress }) => {
      try {
        updateProgress(20, "Generating DTR PDF…");
        const pdfBlob = await generateDTRPdf({ ...item, download: true });

        updateProgress(60, "Preparing download…");
        const cutOff = `${dayjs(item.selectedRecord.DTR_Cut_Off.start).format(
          "MMMM DD, YYYY",
        )}-${dayjs(item.selectedRecord.DTR_Cut_Off.end).format("MMMM DD, YYYY")}`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `DTR_${item.employee.name}_${cutOff}.pdf`;
        link.click();

        updateProgress(80, "Logging record…");
        await logDTRRecord(item.employee, item.selectedRecord, currentUser);
      } catch (err) {
        console.error("Error downloading/logging DTR:", err);
        swalError("Failed to download or log DTR");
      }
    }, "Downloading DTR…");
  };

  const handleDownloadAllDTRs = async () => {
    if (!printerTray.length) {
      swalWarning("Printer tray is empty");
      return;
    }

    await withLoading(async ({ updateProgress }) => {
      try {
        updateProgress(10, "Generating batch DTR PDF…");
        await generateBatchDTRPdf(printerTray);
        swalSuccess("Batch DTR PDF downloaded.");

        const total = printerTray.length;
        for (let i = 0; i < total; i++) {
          const item = printerTray[i];
          const { employee, selectedRecord } = item;
          if (!employee || !selectedRecord) continue;

          updateProgress(
            10 + Math.round(((i + 1) / total) * 80),
            `Logging DTR ${i + 1} of ${total}…`,
          );

          try {
            await logDTRRecord(employee, selectedRecord, currentUser);
          } catch (err) {
            console.error(
              `Failed to log DTR for ${employee.name}:`,
              err.response?.data || err.message,
            );
          }
        }

        swalSuccess("All DTRs logged successfully.");
      } catch (err) {
        console.error("Failed to download or log batch DTRs:", err);
        swalError("Failed to download or log batch DTRs.");
      }
    }, "Downloading all DTRs…");
  };

  const handlePrintSelected = async (item) => {
    if (!item || !item.selectedRecord) return;

    const { employee, dtrDays, dtrLogs, selectedRecord } = item;

    try {
      const pdfBlob = await generateDTRPdf({
        employee,
        dtrDays,
        dtrLogs,
        selectedRecord,
        download: true,
      });

      const pdfUrl = URL.createObjectURL(pdfBlob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);

      iframe.onload = async () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        await logDTRRecord(employee, selectedRecord, currentUser);
      };
    } catch (err) {
      console.error("Failed to print/log DTR:", err);
      swalError("Failed to print DTR");
    }
  };

  const handleAddToPrinterTray = (employee) => {
    setPrinterTray((prev) => {
      const exists = prev.some(
        (item) =>
          item.employee.empId === employee.empId &&
          item.selectedRecord.DTR_Record_Name ===
            selectedRecord.DTR_Record_Name,
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          employee,
          dtrDays,
          dtrLogs,
          selectedRecord,
        },
      ];
    });

    swalSuccess(`${employee.name} DTR added to Printer Tray.`);
  };

  const handleClearPrinterTray = () => {
    setPrinterTray([]);
    swalSuccess("Printer Tray cleared.");
  };

  const handleAddSelectedToTray = () => {
    const keySet = new Set(selectedRowKeys);
    const selectedEmployees = employees.filter((emp) =>
      keySet.has(
        emp.stableKey || emp._id || emp.empId || emp.empNo || emp.name,
      ),
    );

    let newItemsCount = 0;
    setPrinterTray((prev) => {
      const newItems = [];
      selectedEmployees.forEach((employee) => {
        const exists = prev.some(
          (item) =>
            item.employee.empId === employee.empId &&
            item.selectedRecord.DTR_Record_Name ===
              selectedRecord.DTR_Record_Name,
        );
        if (!exists) {
          newItems.push({
            employee,
            dtrDays,
            dtrLogs,
            selectedRecord,
          });
        }
      });

      newItemsCount = newItems.length;
      return [...prev, ...newItems];
    });

    if (newItemsCount > 0) {
      swalSuccess(`${newItemsCount} DTR(s) added to Printer Tray.`);
    } else {
      swalInfo("Selected DTR(s) are already in the tray.");
    }
    setSelectedRowKeys([]);
  };

  const columnsBase = useMemo(
    () => [
      {
        title: "Employee No / Type",
        key: "empNoType",
        width: 100,
        render: (_, record) => {
          const color = record.empType === "Regular" ? "#389e0d" : "#fa8c16";
          return (
            <div style={{ width: 150, minWidth: 150, maxWidth: 150 }}>
              <div style={{ fontWeight: "bold", fontSize: "14px", color }}>
                {record.empNo}
              </div>
              <div style={{ fontSize: "12px", color, fontWeight: 500 }}>
                {record.empType}
              </div>
            </div>
          );
        },
      },
      {
        title: "Name / Position",
        key: "namePosition",
        width: 230,
        render: (_, record) => {
          const divisionAcronym =
            divisionAcronyms[record.division] || record.division;
          const sectionAcronym =
            sectionUnitAcronymsFlat[record.sectionOrUnit] ||
            record.sectionOrUnit ||
            "";

          const posAcr = computePositionAcronym(record.position);
          const showAcronym = record.empType === "Regular";
          const positionDisplay = showAcronym
            ? posAcr || record.position
            : record.position;

          return (
            <div style={{ width: 250, minWidth: 250, maxWidth: 250 }}>
              <strong>{record.name}</strong>
              {record.position && (
                <div
                  style={{ fontSize: "12px", color: "#888" }}
                  title={showAcronym ? record.position : undefined}
                >
                  {positionDisplay}
                </div>
              )}
              {(record.division || record.sectionOrUnit) && (
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {divisionAcronym} {sectionAcronym && `| ${sectionAcronym}`}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Employee ID",
        dataIndex: "empId",
        key: "empId",
        width: 70,
        align: "center",
        render: (_, record) => {
          const ids = [record.empId, ...(record.alternateEmpIds || [])]
            .filter(Boolean)
            .join(", ");

          return (
            <div style={{ width: 70, minWidth: 70, maxWidth: 70 }}>{ids}</div>
          );
        },
      },
      {
        title: dtrHeaderTitle,
        key: "dailyTimeRecord",
        width: 500,
        render: (_, record) =>
          dtrDays.length > 0 ? (
            <DTRDayTiles
              days={dtrDays}
              emp={record}
              selectedRecord={selectedRecord}
              divisionColors={divisionColors}
              divisionAcronyms={divisionAcronyms}
              holidaysPH={allHolidays}
              trainingLoading={trainingLoading}
              getEmployeeDayLogs={(emp, dateKey) => {
                const ids = [emp.empId, ...(emp.alternateEmpIds || [])].filter(
                  Boolean,
                );
                for (const id of ids) {
                  if (dtrLogs[id]?.[dateKey]) return dtrLogs[id][dateKey];
                }
                return null;
              }}
              getTrainingDetailsOnDay={(emp, dateKey) => {
                const trainings = employeeTrainings[emp.empId] || [];
                return trainings.find((t) => {
                  const d = dayjs(dateKey);
                  const start = dayjs(t.trainingDate?.[0]);
                  const end = dayjs(t.trainingDate?.[1]);
                  if (!start.isValid() || !end.isValid()) return false;
                  return (
                    d.isSameOrAfter(start, "day") &&
                    d.isSameOrBefore(end, "day")
                  );
                });
              }}
            />
          ) : (
            <span style={{ color: "#888" }}>Select DTR Record</span>
          ),
      },
    ],
    [
      dtrDays,
      dtrLogs,
      selectedRecord,
      dtrHeaderTitle,
      allHolidays,
      employeeTrainings,
      trainingLoading,
    ],
  );

  const actionsColumn = useMemo(
    () => ({
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            loading={viewActionLoadingKey === getEmployeeUiKey(record)}
            onClick={() =>
              runRowAction(
                setViewActionLoadingKey,
                getEmployeeUiKey(record),
                () => handleViewDTR(record),
              )
            }
            style={{ fontSize: 12 }}
          />

          <Button
            type="default"
            size="small"
            icon={<PrinterOutlined />}
            loading={trayActionLoadingKey === getEmployeeUiKey(record)}
            onClick={() =>
              runRowAction(
                setTrayActionLoadingKey,
                getEmployeeUiKey(record),
                () => handleAddToPrinterTray(record),
              )
            }
            style={{ fontSize: 12 }}
          />
        </Space>
      ),
    }),
    [viewActionLoadingKey, trayActionLoadingKey],
  );

  const columns = useMemo(
    () => (selectedDtrRecord ? [...columnsBase, actionsColumn] : columnsBase),
    [selectedDtrRecord, columnsBase, actionsColumn],
  );

  const empTypeOptions = useMemo(
    () =>
      [...new Set(employees.map((emp) => emp.empType).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((type) => ({ label: type, value: type })),
    [employees],
  );

  const handlePreviewForm48 = (employee, record) => {
    generateDTRPdf({
      employee,
      dtrDays,
      dtrLogs,
      selectedRecord: record,
    });
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        Process Daily Time Records
      </Title>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <DTRFilters
          selectedDtrRecord={selectedDtrRecord}
          setSelectedDtrRecord={setSelectedDtrRecord}
          dtrRecords={dtrRecords}
          searchText={searchText}
          setSearchText={setSearchText}
          empTypeFilter={empTypeFilter}
          setEmpTypeFilter={setEmpTypeFilter}
          empTypeOptions={empTypeOptions}
          sectionOrUnitFilter={sectionOrUnitFilter}
          setSectionOrUnitFilter={setSectionOrUnitFilter}
          dtrLogsLoading={dtrLogsLoading}
        />

        <Space size={4}>
          {selectedDtrRecord && (
            <>
              <Tooltip title="No time records">
                <Button
                  type="primary"
                  danger
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => {
                    if (!selectedRecord) return;
                    setFilteredEmployees(missingDtrEmployees);
                    swalWarning(
                      `Showing ${missingDtrEmployees.length} employees with no DTR at all`,
                    );
                  }}
                >
                  ({missingDtrEmployees.length})
                </Button>
              </Tooltip>
              <Tooltip title="Reset Filter">
                <Button
                  type="primary"
                  icon={<UndoOutlined />}
                  onClick={() => {
                    setFilteredEmployees(sortEmployees(employees));
                  }}
                />
              </Tooltip>
              <Tooltip title="Add to Tray">
                <Button
                  type="primary"
                  icon={<PlusSquareOutlined />}
                  onClick={handleAddSelectedToTray}
                  disabled={!selectedRowKeys.length}
                >
                  ({selectedRowKeys.length})
                </Button>
              </Tooltip>
            </>
          )}
          <Tooltip title="Printer Tray">
            <Badge count={printerTray.length} overflowCount={99}>
              <Button
                icon={<MenuOutlined />}
                type="primary"
                onClick={() => setDrawerVisible(true)}
                disabled={printerTray.length === 0}
              />
            </Badge>
          </Tooltip>
        </Space>
      </div>

      {employeesLoading ? (
        <Spin size="large" style={{ display: "block", margin: "48px auto" }} />
      ) : (
        <DTRTable
          columns={columns}
          dataSource={filteredEmployees}
          loading={dtrLogsLoading}
          dtrDays={dtrDays}
          dtrLogs={dtrLogs}
          selectedRecord={selectedRecord}
          hasAnyDTRLogs={hasAnyDTRLogs}
          handleViewDTR={handleViewDTR}
          handlePrintSelected={handlePrintSelected}
          handleAddToPrinterTray={handleAddToPrinterTray}
          selectedDtrRecord={selectedDtrRecord}
          rowSelection={selectedDtrRecord ? rowSelection : null}
        />
      )}

      <PrinterTrayDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        printerTray={printerTray}
        handleViewDTR={handleViewDTR}
        handlePrintSelected={handlePrintSelected}
        handleDownloadDTR={handleDownloadDTR}
        handleDownloadAllDTRs={handleDownloadAllDTRs}
        handleClearPrinterTray={handleClearPrinterTray}
        handlePreviewForm48={handlePreviewForm48}
      />

      {selectedEmployee && (
        <ViewDTR
          visible={viewDTRVisible}
          onClose={() => setViewDTRVisible(false)}
          employee={selectedEmployee}
          dtrDays={dtrDays}
          dtrLogs={dtrLogs}
          selectedRecord={selectedRecord}
          holidaysPH={allHolidays}
          trainings={employeeTrainings[selectedEmployee.empId] || []}
          trainingLoading={trainingLoading}
          onSaveToTray={handleAddToPrinterTray}
          onPreviewForm48={handlePrintSelected}
        />
      )}
    </div>
  );
};

export default DTRProcess;
