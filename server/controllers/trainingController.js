import Training from "../models/Training.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import { recordAudit } from '../utils/auditHelper.js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import Tesseract from "tesseract.js";

// ---------- Helpers ----------

const normalizeForMatch = (s) => {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Build multiple name forms: "last, first middle", "first middle last", "first last"
const buildNameVariants = (name) => {
  const norm = normalizeForMatch(name);
  if (!norm) return [];
  const variants = [norm];

  // If "Last, First Middle" format → also build "First Middle Last"
  if (name.includes(",")) {
    const parts = name.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      const last = normalizeForMatch(parts[0]);
      const firstMiddle = normalizeForMatch(parts.slice(1).join(" "));
      variants.push(`${firstMiddle} ${last}`);
      // Also "first last" without middle
      const firstTokens = firstMiddle.split(" ").filter(Boolean);
      if (firstTokens.length > 1) {
        variants.push(`${firstTokens[0]} ${last}`);
      }
    }
  } else {
    // "First Middle Last" → also build "Last, First Middle"
    const tokens = norm.split(" ").filter(Boolean);
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1];
      const firstMiddle = tokens.slice(0, -1).join(" ");
      variants.push(`${last} ${firstMiddle}`);
      // Also "first last"
      variants.push(`${tokens[0]} ${last}`);
    }
  }

  return [...new Set(variants)].filter(Boolean);
};

// ---------- Controllers ----------

// GET all trainings
export const getAllTrainings = async (req, res) => {
  try {
    const { start, end } = req.query;

    // Optional date overlap filter: trainingDate[0] <= end && trainingDate[1] >= start
    let filter = {};
    if (start || end) {
      const s = start ? new Date(start) : null;
      const e = end ? new Date(end) : null;
      filter = {
        ...(s ? { "trainingDate.1": { $gte: s } } : {}),
        ...(e ? { "trainingDate.0": { $lte: e } } : {}),
      };
    }

    const trainings = await Training.find(filter).sort({ trainingDate: -1 });
    // Role detection
    let isDev = false;
    try {
      const callerId = req.user?.id || req.user?._id;
      if (callerId) {
        const caller = await User.findById(callerId).lean();
        if (caller) {
          isDev = Boolean(caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev);
        }
      }
    } catch (_) {}

    // Graylist or hide resigned participants depending on role
    try {
      const Employee = (await import('../models/Employee.js')).default;
      const empIds = new Set();
      trainings.forEach(t => (t.participants || []).forEach(p => { if (p.empId) empIds.add(p.empId); }));
      if (empIds.size) {
        const resigned = await Employee.find({ empId: { $in: Array.from(empIds) }, isResigned: true }).select('empId').lean();
        const resignedSet = new Set(resigned.map(r => r.empId));
        trainings.forEach(t => {
          const parts = Array.isArray(t.participants) ? t.participants : [];
          if (isDev) {
            parts.forEach(p => { if (p.empId && resignedSet.has(p.empId)) p.resigned = true; });
          } else {
            t.participants = parts.filter(p => !resignedSet.has(p.empId));
          }
        });
      }
    } catch (_) {}
    res.json(trainings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
};

// GET a single training by ID
export const getTrainingById = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training)
      return res.status(404).json({ message: "Training not found" });
    res.json(training);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch training" });
  }
};

// CREATE a new training
export const createTraining = async (req, res) => {
  try {
    const participants = req.body.participants || [];

    const training = new Training({
      name: req.body.name,
      host: req.body.host,
      venue: req.body.venue,
      trainingDate: req.body.trainingDate,
      participants,
      iisTransaction: req.body.iisTransaction, // Special Order No. or IIS Transaction No.
    });

    await training.save();
    recordAudit('training:created', req, { id: String(training._id), name: req.body.name });
    res.status(201).json(training);
  } catch (err) {
    console.error("Failed to create training:", err);
    res.status(500).json({ message: "Failed to create training" });
  }
};

// UPDATE a training
export const updateTraining = async (req, res) => {
  try {
    const participants = req.body.participants || [];

    const updateData = {
      name: req.body.name,
      host: req.body.host,
      venue: req.body.venue,
      trainingDate: req.body.trainingDate,
      participants,
      iisTransaction: req.body.iisTransaction,
    };

    const updated = await Training.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updated)
      return res.status(404).json({ message: "Training not found" });
    recordAudit('training:updated', req, { id: req.params.id, name: req.body.name });
    res.json(updated);
  } catch (err) {
    console.error("Failed to update training:", err);
    res.status(500).json({ message: "Failed to update training" });
  }
};

// DELETE a training
export const deleteTraining = async (req, res) => {
  try {
    const deleted = await Training.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Training not found" });
    recordAudit('training:deleted', req, { id: req.params.id, name: deleted.name });
    res.json({ message: "Training deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete training" });
  }
};


// GET trainings by employeeId
export const getTrainingsByEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    if (!empId) return res.status(400).json({ message: "empId is required" });

    const trainings = await Training.find({ "participants.empId": empId });
    // Role detection
    let isDev = false;
    try {
      const callerId = req.user?.id || req.user?._id;
      if (callerId) {
        const caller = await User.findById(callerId).lean();
        if (caller) {
          isDev = Boolean(caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev);
        }
      }
    } catch (_) {}

    // Mark/Filter participant if applicable
    try {
      const Employee = (await import('../models/Employee.js')).default;
      const emp = await Employee.findOne({ empId }).select('isResigned').lean();
      if (emp?.isResigned) {
        if (isDev) {
          trainings.forEach(t => {
            (t.participants || []).forEach(p => { if (p.empId === empId) p.resigned = true; });
          });
        } else {
          // HR cannot view resigned employee trainings
          return res.json({ data: [] });
        }
      }
    } catch (_) {}

    res.json({ data: trainings });
  } catch (err) {
    console.error("Failed to fetch trainings by employee:", err);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
};

// Public: GET trainings by employeeId (limited fields, no auth required)
export const getTrainingsByEmployeePublic = async (req, res) => {
  try {
    const { empId } = req.params;
    if (!empId) return res.status(400).json({ message: "empId is required" });

    // Return only fields needed by public DTR preview
    const trainings = await Training.find({ "participants.empId": empId })
      .select("name trainingDate iisTransaction")
      .lean();

    return res.json({ data: trainings || [] });
  } catch (err) {
    console.error("Failed to fetch trainings by employee (public):", err);
    return res.status(500).json({ message: "Failed to fetch trainings" });
  }
};

/**
 * POST /trainings/scan-attendance
 * Accepts a PDF or image file (multipart/form-data, field "file"),
 * extracts text, and matches names against the employee database.
 */
export const scanAttendance = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { buffer, mimetype, originalname } = req.file;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({ success: false, message: "Unsupported file type. Use PDF, JPEG, PNG, or WebP." });
    }

    // Validate size (10MB max)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "File too large. Maximum 10MB." });
    }

    let extractedText = "";

    if (mimetype === "application/pdf") {
      // PDF text extraction
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || "";
    } else {
      // Image OCR
      const { data } = await Tesseract.recognize(buffer, "eng", {
        logger: () => {}, // suppress progress logs
      });
      extractedText = data.text || "";
    }

    if (!extractedText.trim()) {
      return res.json({
        success: true,
        matchedEmployees: [],
        extractedNames: [],
        unmatchedNames: [],
        message: "No text could be extracted from the document",
      });
    }

    // Split text into lines and extract potential names
    // A name-like line: 2+ words, mostly alphabetic, 3-60 chars
    const lines = extractedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const nameRegex = /^[A-Za-zÀ-ÿñÑ.,\-'\s]{3,80}$/;
    const stopWords = new Set([
      "training", "seminar", "workshop", "attendance", "sheet", "participants",
      "date", "time", "name", "signature", "position", "office", "division",
      "section", "unit", "venue", "host", "subject", "total", "page", "program",
      "region", "department", "bureau", "republic", "philippines", "denr", "emb",
      "environmental", "management", "clearance", "permitting", "monitoring",
      "enforcement", "finance", "administrative", "director", "schedule",
      "morning", "afternoon", "session", "january", "february", "march",
      "april", "may", "june", "july", "august", "september", "october",
      "november", "december", "monday", "tuesday", "wednesday", "thursday",
      "friday", "saturday", "sunday",
    ]);

    // Title prefixes used to split side-by-side names in OCR output
    const titlePrefixPattern = /\b(Mr|Mrs|Ms|Miss|Dr|Engr|Atty|Hon|For|Prof|Sir|Ma'am|Madam|Rev|Fr|Sr|Br)\.?\s+/gi;

    const extractedNames = [];
    for (const line of lines) {
      // Skip lines that are numbers, dates, or too short
      if (/^\d+[\.\)]?\s*$/.test(line)) continue;
      if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(line)) continue;

      // Handle numbered lists: "1. Juan Dela Cruz" or "1) Juan Dela Cruz"
      const cleaned = line.replace(/^\d+[\.\)]\s*/, "").trim();

      // Split by title prefixes to handle side-by-side names (e.g., "Mr. Juan Cruz Ms. Maria Santos")
      const segments = [];
      const prefixMatches = [...cleaned.matchAll(titlePrefixPattern)];
      if (prefixMatches.length >= 2) {
        for (let pi = 0; pi < prefixMatches.length; pi++) {
          const start = prefixMatches[pi].index;
          const end = pi + 1 < prefixMatches.length ? prefixMatches[pi + 1].index : cleaned.length;
          const seg = cleaned.slice(start, end).trim();
          if (seg) segments.push(seg);
        }
        // Also add text before first prefix if it looks like a name
        if (prefixMatches[0].index > 0) {
          const before = cleaned.slice(0, prefixMatches[0].index).trim();
          if (before) segments.unshift(before);
        }
      } else {
        segments.push(cleaned);
      }

      for (const segment of segments) {
        // Handle comma-separated rows (e.g., "Juan Dela Cruz, Engineer III, CPD")
        const firstPart = segment.split(/\t/)[0].split(/,/)[0].trim();
        // Strip title prefix for matching but keep original for display
        const stripped = firstPart.replace(titlePrefixPattern, "").trim();
        const candidate = stripped || firstPart;

        if (nameRegex.test(candidate) && candidate.split(/\s+/).length >= 2) {
          const isStop = candidate.split(/\s+/).every((w) => stopWords.has(w.toLowerCase()));
          if (!isStop) {
            extractedNames.push(candidate);
          }
        }
      }
    }

    // Fetch all active employees
    const allEmployees = await Employee.find({ isResigned: { $ne: true } })
      .select("empId empNo name normalizedName division sectionOrUnit position empType")
      .lean();

    // Build a lookup index
    const empIndex = allEmployees.map((emp) => ({
      ...emp,
      variants: buildNameVariants(emp.name),
    }));

    // Match extracted names against employees
    const matchedEmployees = [];
    const matchedEmpIds = new Set();
    const unmatchedNames = [];

    for (const extractedName of extractedNames) {
      const extractedVariants = buildNameVariants(extractedName);
      let bestMatch = null;
      let bestScore = 0;

      for (const emp of empIndex) {
        for (const ev of extractedVariants) {
          for (const mv of emp.variants) {
            // Exact match
            if (ev === mv) {
              bestMatch = emp;
              bestScore = 100;
              break;
            }
            // Substring containment (one contains the other)
            if (ev.length >= 5 && mv.length >= 5) {
              if (mv.includes(ev) || ev.includes(mv)) {
                const score = Math.min(ev.length, mv.length) / Math.max(ev.length, mv.length) * 90;
                if (score > bestScore) {
                  bestMatch = emp;
                  bestScore = score;
                }
              }
            }
            // Token overlap: if 2+ significant tokens match
            const evTokens = ev.split(" ").filter((t) => t.length >= 2);
            const mvTokens = mv.split(" ").filter((t) => t.length >= 2);
            const commonTokens = evTokens.filter((t) => mvTokens.includes(t));
            if (commonTokens.length >= 2) {
              const score = (commonTokens.length / Math.max(evTokens.length, mvTokens.length)) * 80;
              if (score > bestScore) {
                bestMatch = emp;
                bestScore = score;
              }
            }
          }
          if (bestScore === 100) break;
        }
        if (bestScore === 100) break;
      }

      if (bestMatch && bestScore >= 50 && !matchedEmpIds.has(bestMatch.empId)) {
        matchedEmpIds.add(bestMatch.empId);
        matchedEmployees.push({
          empId: bestMatch.empId,
          empNo: bestMatch.empNo,
          name: bestMatch.name,
          division: bestMatch.division,
          sectionOrUnit: bestMatch.sectionOrUnit,
          position: bestMatch.position,
          type: bestMatch.empType,
          matchedFrom: extractedName,
          confidence: Math.round(bestScore),
        });
      } else if (!bestMatch || bestScore < 50) {
        unmatchedNames.push(extractedName);
      }
    }

    recordAudit("training:attendance-scanned", req, {
      filename: originalname,
      extractedCount: extractedNames.length,
      matchedCount: matchedEmployees.length,
      unmatchedCount: unmatchedNames.length,
    });

    res.json({
      success: true,
      matchedEmployees,
      extractedNames,
      unmatchedNames,
      rawText: extractedText,
    });
  } catch (err) {
    console.error("scanAttendance error:", err);
    res.status(500).json({ success: false, message: "Failed to process document" });
  }
};

/**
 * POST /trainings/rematch-names
 * Accepts an array of edited name strings, matches each against the employee database.
 */
export const rematchNames = async (req, res) => {
  try {
    const { names } = req.body;
    if (!Array.isArray(names) || !names.length) {
      return res.status(400).json({ success: false, message: "names array is required" });
    }

    // Sanitize: only allow reasonable name strings
    const sanitized = names
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter((n) => n.length >= 2 && n.length <= 100);

    const allEmployees = await Employee.find({ isResigned: { $ne: true } })
      .select("empId empNo name normalizedName division sectionOrUnit position empType")
      .lean();

    const empIndex = allEmployees.map((emp) => ({
      ...emp,
      variants: buildNameVariants(emp.name),
    }));

    const matchedEmployees = [];
    const matchedEmpIds = new Set();
    const unmatchedNames = [];

    for (const extractedName of sanitized) {
      const extractedVariants = buildNameVariants(extractedName);
      let bestMatch = null;
      let bestScore = 0;

      for (const emp of empIndex) {
        for (const ev of extractedVariants) {
          for (const mv of emp.variants) {
            if (ev === mv) {
              bestMatch = emp;
              bestScore = 100;
              break;
            }
            if (ev.length >= 5 && mv.length >= 5) {
              if (mv.includes(ev) || ev.includes(mv)) {
                const score = (Math.min(ev.length, mv.length) / Math.max(ev.length, mv.length)) * 90;
                if (score > bestScore) {
                  bestMatch = emp;
                  bestScore = score;
                }
              }
            }
            const evTokens = ev.split(" ").filter((t) => t.length >= 2);
            const mvTokens = mv.split(" ").filter((t) => t.length >= 2);
            const commonTokens = evTokens.filter((t) => mvTokens.includes(t));
            if (commonTokens.length >= 2) {
              const score = (commonTokens.length / Math.max(evTokens.length, mvTokens.length)) * 80;
              if (score > bestScore) {
                bestMatch = emp;
                bestScore = score;
              }
            }
          }
          if (bestScore === 100) break;
        }
        if (bestScore === 100) break;
      }

      if (bestMatch && bestScore >= 50 && !matchedEmpIds.has(bestMatch.empId)) {
        matchedEmpIds.add(bestMatch.empId);
        matchedEmployees.push({
          empId: bestMatch.empId,
          empNo: bestMatch.empNo,
          name: bestMatch.name,
          division: bestMatch.division,
          sectionOrUnit: bestMatch.sectionOrUnit,
          position: bestMatch.position,
          type: bestMatch.empType,
          matchedFrom: extractedName,
          confidence: Math.round(bestScore),
        });
      } else {
        unmatchedNames.push(extractedName);
      }
    }

    res.json({ success: true, matchedEmployees, unmatchedNames });
  } catch (err) {
    console.error("rematchNames error:", err);
    res.status(500).json({ success: false, message: "Failed to rematch names" });
  }
};
