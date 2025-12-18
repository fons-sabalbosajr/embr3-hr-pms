import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Typography, Spin, Space, Button, Dropdown, Menu, Tag, Badge, App } from "antd";
import { EyeOutlined, PrinterOutlined, MenuOutlined } from "@ant-design/icons";
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
import "./dtr.css";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import axiosInstance from "../../../../api/axiosInstance";
import axios from "axios";

const { Title } = Typography;

// Extend dayjs with the plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);
const LOCAL_TZ = "Asia/Manila";

// States mapping for tooltip labels
const STATE_LABELS = {
  // Common biometric states → normalized labels
  "C/In": "Time In",
  "Check In": "Time In",
  "IN": "Time In",
  In: "Time In",
  "C/Out": "Time Out",
  "Check Out": "Time Out",
  "OUT": "Time Out",
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

const divisionAcronyms = parseEnvJson(import.meta.env.VITE_DIVISION_ACRONYMS, {});
const sectionUnitAcronymsFlat = parseEnvJson(
  import.meta.env.VITE_SECTION_OR_UNIT_ACRONYMS,
  {}
);
const positionAcronymsMap = parseEnvJson(
  import.meta.env.VITE_POSITION_ACRONYMS,
  {}
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
const normalizePositionKey = (s) => (typeof s === "string" ? s.trim().toUpperCase() : "");

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
    const rank = /^(?:[IVXLCM]+|\d+)$/.test(last) ? ` ${last.toUpperCase()}` : "";
    return `ENGR${rank}`;
  }

  // Generic builder: take capital initials of significant words, keep trailing roman numeral/number
  const stopWords = new Set(["of", "and", "the", "unit", "section", "division"]);
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
  const { message: appMessage } = App.useApp();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const [employeeTrainings, setEmployeeTrainings] = useState({});
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const location = useLocation();

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/employees`);
      const sortedData = sortEmployees(res.data).map((emp, idx) => ({
        ...emp,
        stableKey: emp._id || emp.empId || emp.empNo || `${emp.name || 'emp'}__${idx}`,
      }));
      setEmployees(sortedData);
      setFilteredEmployees(sortedData);
      // Defer DTR logs loading until a record is selected to reduce initial load
      // Apply deep-link empId filter if present in query params
      const params = new URLSearchParams(location.search);
      const empIdParam = params.get('empId');
      if (empIdParam) {
        setSearchText(empIdParam);
        setFilteredEmployees(
          sortedData.filter((e) =>
            [e.empId, e.empNo, e.name, e.normalizedName]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(empIdParam.toLowerCase()))
          )
        );
      }
    } catch (err) {
  console.error("Failed to fetch employees:", err);
  appMessage.error("Unable to load employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchDtrLogs = async (employees) => {
    try {
      setLoading(true);

      const employeeNames = employees.map((emp) => emp.name).filter(Boolean);
      const employeeEmpIds = employees.map((emp) => emp.empId).filter(Boolean);

      const startOfMonth = dayjs().startOf("month").format("YYYY-MM-DD");
      const endOfMonth = dayjs().endOf("month").format("YYYY-MM-DD");

      const res = await axiosInstance.get(`/dtrlogs/merged`, {
        params: {
          names: employeeNames.join(","),
          empIds: employeeEmpIds.join(","),
          startDate: startOfMonth,
          endDate: endOfMonth,
        },
      });
      const logsPayload = Array.isArray(res.data) ? res.data : res.data?.data;
      if (!logsPayload) {
        appMessage.error("Failed to load DTR logs");
        return;
      }
      const logs = logsPayload;
      const logsByEmpDay = {};

      logs.forEach((log) => {
        if (!log.empId) return;

        const empKey = log.empId;

        const dateKey = dayjs(log.time).tz(LOCAL_TZ).format("YYYY-MM-DD");

        if (!logsByEmpDay[empKey]) logsByEmpDay[empKey] = {};
        if (!logsByEmpDay[empKey][dateKey]) {
          logsByEmpDay[empKey][dateKey] = {
            "Time In": null,
            "Break Out": null,
            "Break In": null,
            "Time Out": null,
          };
        }

        const stateLabel = STATE_LABELS[log.state];
        if (stateLabel) {
          logsByEmpDay[empKey][dateKey][stateLabel] = dayjs(log.time)
            .tz(LOCAL_TZ)
            .format("hh:mm A");
        }
      });

      setDtrLogs(logsByEmpDay);
    } catch (error) {
      console.error("Failed to fetch DTR logs:", error);
      appMessage.error("Error loading DTR logs");
      setDtrLogs({});
    } finally {
      setLoading(false);
    }
  };

  // Fetch logs for a specific DTR record (handles pagination and robust candidate mapping)
  const fetchDtrLogsByRecord = async (selectedRecord, employees) => {
    try {
      setLoading(true);

      const employeeNames = employees.map((emp) => emp.name).filter(Boolean);
      const employeeEmpIds = employees.map((emp) => emp.empId).filter(Boolean);

      // Fetch all pages to avoid pagination truncation on server (max 500 per page)
      const limit = 500;
      let page = 1;
      let total = 0;
      let allLogs = [];
      while (true) {
        const res = await axiosInstance.get(`/dtrlogs/merged`, {
          params: {
            recordName: selectedRecord.DTR_Record_Name,
            names: employeeNames.join(","),
            empIds: employeeEmpIds.join(","),
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
      let logsPayload = allLogs;
      if (!logsPayload) {
        appMessage.error("Failed to load DTR logs");
        setDtrLogs({});
        return;
      }

      // Pre-filter logs to the selected record's cut-off window and to names matching our employees
      try {
        const cutStart = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ).startOf("day");
        const cutEnd = dayjs.tz(selectedRecord.DTR_Cut_Off.end, LOCAL_TZ).endOf("day");

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
                if (tk && logName.includes(tk)) return true;
              }
            }
          }

          // If no name match, still keep logs that contain numeric identifiers matching employees (AC-No, empNo, cardNo)
          const numeric = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");
          const fields = [log.acNo, log["AC-No"], log["AC No"], log.empNo, log.cardNo, log.badge, log.userid, log.userId];
          for (const f of fields) {
            if (!f) continue;
            const nf = numeric(f);
            if (!nf) continue;
            for (const emp of employees) {
              if (!emp) continue;
              const cand = [emp.empId, emp.empNo, emp.acNo, emp.cardNo, emp.badge].filter(Boolean).map(numeric);
              if (cand.includes(nf)) return true;
            }
          }

          return false;
        });
      } catch (e) {
        // Non-fatal: if anything goes wrong here, fall back to unfiltered payload
        console.warn("DTR pre-filter failed, using unfiltered logs:", e);
      }
      const logsByEmpDay = {};

      // Build robust client-side mapping from AC-No/name → empId
      const normalizeDigits = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");
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
          if (!digitsToEmpIds.has(digits)) digitsToEmpIds.set(digits, new Set());
          digitsToEmpIds.get(digits).add(id);
        }
        const lowered = s.toLowerCase().trim();
        if (lowered) empIdByCandidate.set(lowered, id);
        const compact = lowered.replace(/\s+/g, "");
        if (compact) empIdByCandidate.set(compact, id);
      };

      // Debug target (temporary): digits to watch for mapping issues
      const DEBUG_TARGET_DIGITS = "1007";

      employees.forEach((emp) => {
        if (!emp) return;
        const primaryEmpId = emp.empId;
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
          if (!found && d && empIdByCandidate.has(d)) found = empIdByCandidate.get(d);
          const low = s.toLowerCase().trim();
          if (!found && empIdByCandidate.has(low)) found = empIdByCandidate.get(low);
          const compact = low.replace(/\s+/g, "");
          if (!found && empIdByCandidate.has(compact)) found = empIdByCandidate.get(compact);

          // Debug logging when the lookup involves the target digits
          try {
            if (String(s).includes(DEBUG_TARGET_DIGITS) || (d && d.includes(DEBUG_TARGET_DIGITS))) {
              console.debug("DTR_DEBUG tryLookup", { val: s, digits: d, found });
            }
          } catch (e) {}
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
            // pick best candidate
            let best = null;
            let bestCount = 0;
            for (const [eid, cnt] of score.entries()) {
              if (cnt > bestCount) {
                best = eid;
                bestCount = cnt;
              } else if (cnt === bestCount) {
                // tie → prefer exact last-name match if present
                const eidTokens = empTokensMap.get(eid) || [];
                const bestTokens = empTokensMap.get(best) || [];
                const lastLog = logTokens[logTokens.length - 1];
                if (lastLog && eidTokens.includes(lastLog) && !bestTokens.includes(lastLog)) {
                  best = eid;
                }
              }
            }

            // Apply threshold: require at least 2 token matches OR a clear unique single-token match of a longer token
            if (best && (bestCount >= 2 || (bestCount === 1 && logTokens.some(t => t.length >= 4)))) {
              empKey = best;
            }
            // If the empKey is still ambiguous but the log contains numeric identifiers that map strongly, prefer numeric
            if (!empKey) {
              const numeric = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");
              const fields = [log.acNo, log["AC-No"], log["AC No"], log.empNo, log.cardNo, log.badge, log.userid, log.userId];
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
            "Time In": [],
            "Break Out": [],
            "Break In": [],
            "Time Out": [],
            // collect overtime punches separately so weekend OT can be shown
            "OT In": [],
            "OT Out": [],
          };
        }

        const stateLabel = STATE_LABELS[log.state];
        if (stateLabel) {
          const t = dayjs(log.time).tz(LOCAL_TZ).format("hh:mm A");
          let arr = logsByEmpDay[empKey][dateKey][stateLabel];
          // normalize to array
          if (!Array.isArray(arr)) {
            arr = arr ? [arr] : [];
          }
          // avoid pushing duplicates
          if (!arr.includes(t)) arr.push(t);
          logsByEmpDay[empKey][dateKey][stateLabel] = arr;
        }
      });

      // Cleanup: sort and dedupe all time arrays (ensure consistent ordering and remove duplicates)
      Object.keys(logsByEmpDay).forEach((empKey) => {
        Object.keys(logsByEmpDay[empKey]).forEach((dateKey) => {
          const dayObj = logsByEmpDay[empKey][dateKey];
          Object.keys(dayObj).forEach((label) => {
            const val = dayObj[label];
            if (Array.isArray(val)) {
              const unique = Array.from(new Set(val));
              unique.sort((a, b) => {
                const da = dayjs(a, "hh:mm A");
                const db = dayjs(b, "hh:mm A");
                if (da.isValid() && db.isValid()) return da.isBefore(db) ? -1 : 1;
                return String(a).localeCompare(String(b));
              });
              dayObj[label] = unique;
            }
          });
        });
      });

      setDtrLogs(logsByEmpDay);
    } catch (error) {
      console.error("Failed to fetch DTR logs (by record):", error);
      appMessage.error("Error loading DTR logs for selected record");
      setDtrLogs({});
    } finally {
      setLoading(false);
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
        appMessage.error("Unable to load DTR records");
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
          emp.empId?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (empTypeFilter) {
      data = data.filter((emp) => emp.empType === empTypeFilter);
    }

    if (sectionOrUnitFilter) {
      data = data.filter((emp) =>
        emp.sectionOrUnit
          ?.toLowerCase()
          .includes(sectionOrUnitFilter.toLowerCase())
      );
    }

    setFilteredEmployees(sortEmployees(data));
  }, [searchText, empTypeFilter, sectionOrUnitFilter, employees]);

  const recordsSafe = Array.isArray(dtrRecords) ? dtrRecords : [];
  const selectedRecord = recordsSafe.find(
    (rec) => rec.DTR_Record_Name === selectedDtrRecord
  );

  let dtrDays = [];

  if (
    selectedRecord &&
    selectedRecord.DTR_Cut_Off?.start &&
    selectedRecord.DTR_Cut_Off?.end
  ) {
    const start = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ);
    const end = dayjs.tz(selectedRecord.DTR_Cut_Off.end, LOCAL_TZ);

    if (!start.isValid() || !end.isValid()) {
      console.error(
        "Invalid DTR_Cut_Off dates:",
        selectedRecord.DTR_Cut_Off.start,
        selectedRecord.DTR_Cut_Off.end
      );
      dtrDays = [];
    } else {
      const recordName = selectedRecord.DTR_Record_Name || "";
      if (recordName.includes("1-15")) {
        dtrDays = Array.from({ length: 15 }, (_, i) => i + 1);
      } else if (recordName.includes("16-")) {
        const endOfMonth = start.endOf("month").date();
        const numDays = endOfMonth - 16 + 1;
        dtrDays = Array.from({ length: numDays }, (_, i) => i + 16);
      } else {
        let curr = start.clone();
        while (curr.isSameOrBefore(end, "day")) {
          dtrDays.push(curr.date());
          curr = curr.add(1, "day");
        }
      }
    }
  }

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
        const start = dayjs(selectedRecord.DTR_Cut_Off.start);
        const end = dayjs(selectedRecord.DTR_Cut_Off.end);
        const year = start.year();
        const holidays = await fetchPhilippineHolidays(year);
        const filtered = holidays
          .filter((h) => {
            const hDate = dayjs(h.date);
            return (
              hDate.isSameOrAfter(start, "day") &&
              hDate.isSameOrBefore(end, "day")
            );
          })
          .map((h) => ({
            date: h.date,
            name: h.localName,
            type: h.type,
          }));
        setHolidaysPH(filtered);
        // Fetch local holidays and suspensions in the same window
        try {
          const [lh, ss] = await Promise.all([
            axiosInstance.get(`/local-holidays`, { params: { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') } }),
            axiosInstance.get(`/suspensions`, { params: { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') } }),
          ]);
          setLocalHolidays((lh.data?.data||[]).map(h=>({
            date: dayjs(h.date).format('YYYY-MM-DD'),
            endDate: h.endDate ? dayjs(h.endDate).format('YYYY-MM-DD') : null,
            name: h.name,
            type: 'Local Holiday',
            location: h.location,
            notes: h.notes,
          })));
          setSuspensions((ss.data?.data||[]).map(s=>({
            date: dayjs(s.date).format('YYYY-MM-DD'),
            endDate: s.endDate ? dayjs(s.endDate).format('YYYY-MM-DD') : null,
            name: s.title,
            type: 'Suspension',
            scope: s.scope,
            location: s.location,
            referenceType: s.referenceType,
            referenceNo: s.referenceNo,
            notes: s.notes,
          })));
        } catch(e) {
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
        const start = dayjs(selectedRecord.DTR_Cut_Off.start).format("YYYY-MM-DD");
        const end = dayjs(selectedRecord.DTR_Cut_Off.end).format("YYYY-MM-DD");
        const res = await axiosInstance.get(`/trainings`, { params: { start, end } });
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
    const empKey = emp.empId;
    if (!dtrLogs[empKey]) return false;

    return dtrDays.some((dayNum) => {
      const dateKey = dayjs(selectedRecord.DTR_Cut_Off.start)
        .date(dayNum)
        .format("YYYY-MM-DD");
      const dayLogs = dtrLogs[empKey][dateKey];
      if (!dayLogs) return false;
      return Object.values(dayLogs).some((v) =>
        Array.isArray(v) ? v.length > 0 : Boolean(v)
      );
    });
  };

  const getDTRHeaderTitle = () => {
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
  };

  const handleViewDTR = (employee) => {
    setSelectedEmployee(employee);
    setViewDTRVisible(true);
  };

  const logDTRRecord = async (employee, selectedRecord, currentUser) => {
    if (!employee?.empId || !selectedRecord) return;

    const cutOff = `${dayjs(selectedRecord.DTR_Cut_Off.start).format(
      "MMMM DD, YYYY"
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
        `/employee-docs/by-employee/${employee.empId}`
      );

      const existingDocs = existingRes.data?.data || [];

      const isDuplicate = existingDocs.some(
        (doc) =>
          doc.docType === payload.docType &&
          doc.reference === payload.reference &&
          doc.period === payload.period
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
        err.response?.data || err.message
      );
    }
  };

  const handleViewDTRPdf = (item) => {
    generateDTRPdf(item);
  };

  const handleDownloadDTR = async (item) => {
    if (!item || !item.employee || !item.selectedRecord) return;

    try {
      const pdfBlob = await generateDTRPdf({ ...item, download: true });

      const cutOff = `${dayjs(item.selectedRecord.DTR_Cut_Off.start).format(
        "MMMM DD, YYYY"
      )}-${dayjs(item.selectedRecord.DTR_Cut_Off.end).format("MMMM DD, YYYY")}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = `DTR_${item.employee.name}_${cutOff}.pdf`;
      link.click();

      await logDTRRecord(item.employee, item.selectedRecord, currentUser);
    } catch (err) {
  console.error("Error downloading/logging DTR:", err);
  appMessage.error("Failed to download or log DTR");
    }
  };

  const handleDownloadAllDTRs = async () => {
    if (!printerTray.length) {
  appMessage.warning("Printer tray is empty");
      return;
    }

    try {
      await generateBatchDTRPdf(printerTray);
  appMessage.success("Batch DTR PDF downloaded.");

      for (const item of printerTray) {
        const { employee, selectedRecord } = item;
        if (!employee || !selectedRecord) continue;

        try {
          await logDTRRecord(employee, selectedRecord, currentUser);
        } catch (err) {
          console.error(
            `Failed to log DTR for ${employee.name}:`,
            err.response?.data || err.message
          );
        }
      }

  appMessage.success("All DTRs logged successfully.");
    } catch (err) {
      console.error("Failed to download or log batch DTRs:", err);
  appMessage.error("Failed to download or log batch DTRs.");
    }
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
  appMessage.error("Failed to print DTR");
    }
  };

  const handleAddToPrinterTray = (employee) => {
    setPrinterTray((prev) => {
      const exists = prev.some(
        (item) =>
          item.employee.empId === employee.empId &&
          item.selectedRecord.DTR_Record_Name === selectedRecord.DTR_Record_Name
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

  appMessage.success(`${employee.name} DTR added to Printer Tray.`);
  };

  const handleClearPrinterTray = () => {
  setPrinterTray([]);
  appMessage.success("Printer Tray cleared.");
  };

  const handleAddSelectedToTray = () => {
    const keySet = new Set(selectedRowKeys);
    const selectedEmployees = employees.filter((emp) =>
      keySet.has(emp.stableKey || emp._id || emp.empId || emp.empNo || emp.name)
    );

    let newItemsCount = 0;
    setPrinterTray((prev) => {
      const newItems = [];
      selectedEmployees.forEach((employee) => {
        const exists = prev.some(
          (item) =>
            item.employee.empId === employee.empId &&
            item.selectedRecord.DTR_Record_Name ===
              selectedRecord.DTR_Record_Name
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
      appMessage.success(`${newItemsCount} DTR(s) added to Printer Tray.`);
    } else {
      appMessage.info("Selected DTR(s) are already in the tray.");
    }
    setSelectedRowKeys([]);
  };

  const columnsBase = [
    {
      title: "Employee No / Type",
      key: "empNoType",
      width: 130,
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
      width: 270,
      render: (_, record) => {
        const divisionAcronym = divisionAcronyms[record.division] || record.division;
        const sectionAcronym = sectionUnitAcronymsFlat[record.sectionOrUnit] || record.sectionOrUnit || "";

  const posAcr = computePositionAcronym(record.position);
  const showAcronym = record.empType === "Regular";
  const positionDisplay = showAcronym ? (posAcr || record.position) : record.position;

        return (
          <div style={{ width: 250, minWidth: 250, maxWidth: 250 }}>
            <strong>{record.name}</strong>
            {record.position && (
              <div style={{ fontSize: "12px", color: "#888" }} title={showAcronym ? record.position : undefined}>
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
      title: getDTRHeaderTitle(),
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
            holidaysPH={[...holidaysPH, ...localHolidays, ...suspensions]}
            trainingLoading={trainingLoading}
            getEmployeeDayLogs={(emp, dateKey) => {
              const empKey = emp.empId;
              return dtrLogs[empKey]?.[dateKey] || null;
            }}
            getTrainingDetailsOnDay={(emp, dateKey) => {
              const trainings = employeeTrainings[emp.empId] || [];
              return trainings.find((t) => {
                const d = dayjs(dateKey);
                const start = dayjs(t.trainingDate?.[0]);
                const end = dayjs(t.trainingDate?.[1]);
                if (!start.isValid() || !end.isValid()) return false;
                return d.isSameOrAfter(start, "day") && d.isSameOrBefore(end, "day");
              });
            }}
          />
        ) : (
          <span style={{ color: "#888" }}>Select DTR Record</span>
        ),
    },
  ];

  const actionsColumn = {
    title: "Actions",
    key: "actions",
    width: 100,
    render: (_, record) => (
      <Space size="middle">
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDTR(record)}
          style={{ fontSize: 12 }}
        />

        <Button
          type="default"
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => handleAddToPrinterTray(record)}
          style={{ fontSize: 12 }}
        />
      </Space>
    ),
  };

  const columns = selectedDtrRecord
    ? [...columnsBase, actionsColumn]
    : columnsBase;

  const empTypeOptions = [
    ...new Set(employees.map((emp) => emp.empType).filter(Boolean)),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({ label: type, value: type }));

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
      <Space
        style={{
          marginBottom: 16,
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Title level={3}>Process Daily Time Records</Title>

        <Badge count={printerTray.length} overflowCount={99}>
          <Button
            icon={<MenuOutlined />}
            type="primary"
            onClick={() => setDrawerVisible(true)}
            disabled={printerTray.length === 0}
          >
            Printer Tray
          </Button>
        </Badge>
      </Space>

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
      />

      {selectedDtrRecord && (
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            style={{ marginLeft: 8 }}
            danger
            onClick={() => {
              if (!selectedRecord) return;
              const missing = employees.filter(
                (emp) => !hasAnyDTRLogs(emp, dtrDays, dtrLogs, selectedRecord)
              );
              setFilteredEmployees(missing);
              appMessage.warning(
                `Showing ${missing.length} employees with no DTR at all`
              );
            }}
          >
            No time records (
            {
              employees.filter(
                (emp) => !hasAnyDTRLogs(emp, dtrDays, dtrLogs, selectedRecord)
              ).length
            }
            )
          </Button>
          <Button
            type="primary"
            onClick={() => {
              setFilteredEmployees(sortEmployees(employees));
            }}
          >
            Reset Filter
          </Button>

          <Button
            type="primary"
            onClick={handleAddSelectedToTray}
            disabled={!selectedRowKeys.length}
          >
            Add to Tray ({selectedRowKeys.length})
          </Button>
        </Space>
      )}

      {loading ? (
        <Spin size="large" />
      ) : (
        <DTRTable
          columns={columns}
          dataSource={filteredEmployees}
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
          holidaysPH={[...holidaysPH, ...localHolidays, ...suspensions]}
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
