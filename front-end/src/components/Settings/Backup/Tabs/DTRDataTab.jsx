// src/components/Settings/Backup/Tabs/DTRDataTab.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  DatePicker,
  Card,
  Progress,
  Spin,
  Tooltip,
  Select,
  Tag,
  Alert,
  Switch,
} from "antd";
import {
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  MergeCellsOutlined,
  FolderAddOutlined,
  SplitCellsOutlined,
} from "@ant-design/icons";
import {
  swalSuccess,
  swalError,
  swalWarning,
} from "../../../../utils/swalHelper";
import axiosInstance from "../../../../api/axiosInstance";
import dayjs from "dayjs";

const DTRDataTab = () => {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]); // filtered dataset
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState(null); // [start, end]
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState(null);
  const [previewSample, setPreviewSample] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(5);
  const [deleteProgress, setDeleteProgress] = useState(null);
  const deletePollRef = React.useRef(null);
  const [editLogs, setEditLogs] = useState([]);
  const [editLogsLoading, setEditLogsLoading] = useState(false);
  const [editLogsPage, setEditLogsPage] = useState(1);
  const [editLogsPageSize, setEditLogsPageSize] = useState(10);
  const [editLogsTotal, setEditLogsTotal] = useState(0);
  const [editLogsSearch, setEditLogsSearch] = useState("");

  // Move logs in edit modal
  const [editSelectedRowKeys, setEditSelectedRowKeys] = useState([]);
  const [editMoveTarget, setEditMoveTarget] = useState(null);
  const [editMoveLoading, setEditMoveLoading] = useState(false);

  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [mergeSourceIds, setMergeSourceIds] = useState([]);
  const [mergeLoading, setMergeLoading] = useState(false);

  // Merge preview/progress state
  const [mergeStep, setMergeStep] = useState("select"); // select | preview | progress | done
  const [mergePreview, setMergePreview] = useState(null);
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false);
  const [mergeJobId, setMergeJobId] = useState(null);
  const [mergeProgress, setMergeProgress] = useState(null);
  const mergePollRef = React.useRef(null);

  // Container modal state
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [containerStep, setContainerStep] = useState("select"); // select | preview | progress | done
  const [containerPeriodType, setContainerPeriodType] = useState("quarter");
  const [containerYear, setContainerYear] = useState(dayjs().year());
  const [containerPeriodValue, setContainerPeriodValue] = useState(1);
  const [containerPreview, setContainerPreview] = useState(null);
  const [containerPreviewLoading, setContainerPreviewLoading] = useState(false);
  const [containerSelectedIds, setContainerSelectedIds] = useState([]);
  const [containerJobId, setContainerJobId] = useState(null);
  const [containerProgress, setContainerProgress] = useState(null);
  const [containerDeleteSources, setContainerDeleteSources] = useState(true);
  const containerPollRef = React.useRef(null);

  // Unmerge modal state
  const [unmergeModalOpen, setUnmergeModalOpen] = useState(false);
  const [unmergeContainer, setUnmergeContainer] = useState(null);
  const [unmergeStep, setUnmergeStep] = useState("select"); // select | progress | done | cancelled
  const [unmergeJobId, setUnmergeJobId] = useState(null);
  const [unmergeProgress, setUnmergeProgress] = useState(null);
  const [unmergeDateRange, setUnmergeDateRange] = useState(null);
  const [unmergeRecordName, setUnmergeRecordName] = useState("");
  const unmergePollRef = React.useRef(null);

  const watchedRecordName = Form.useWatch("DTR_Record_Name", form);
  const watchedCutOff = Form.useWatch("DTR_Cut_Off", form);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeIso = (d) => {
    if (!d) return undefined;
    const dd = dayjs(d);
    return dd.isValid() ? dd.toISOString() : undefined;
  };

  const getCutoffFromValue = (val) => {
    if (!Array.isArray(val) || !val[0] || !val[1])
      return { startDate: undefined, endDate: undefined };
    return {
      startDate: safeIso(val[0]),
      endDate: safeIso(val[1]),
    };
  };

  const fetchMergedLogs = async ({ recordName, cutOff, page: p, limit }) => {
    const rn = (recordName || "").toString().trim();
    const { startDate, endDate } = getCutoffFromValue(cutOff);
    const res = await axiosInstance.get("/dtrlogs/merged", {
      params: {
        recordName: rn || undefined,
        startDate,
        endDate,
        page: p,
        limit,
      },
    });
    return res?.data;
  };

  // when fetching
  const fetchData = async (range = dateRange) => {
    setLoading(true);
    try {
      const params = {};
      if (Array.isArray(range) && range[0] && range[1]) {
        params.startDate = range[0].toISOString();
        params.endDate = range[1].toISOString();
      }
      const res = await axiosInstance.get("/dtrdatas", { params });
      const rows = res.data?.data ?? res.data ?? [];
      // Sort by cut-off start date descending (newest first)
      rows.sort((a, b) => {
        const aStart = a.DTR_Cut_Off?.start
          ? new Date(a.DTR_Cut_Off.start).getTime()
          : 0;
        const bStart = b.DTR_Cut_Off?.start
          ? new Date(b.DTR_Cut_Off.start).getTime()
          : 0;
        return bStart - aStart;
      });
      setData(rows);
    } catch {
      swalError("Failed to load DTR data");
    } finally {
      setLoading(false);
    }
  };

  // handle search across fetched (already date-filtered) data
  useEffect(() => {
    const lowered = (searchText || "").toLowerCase();
    const results = (data || []).filter((d) =>
      JSON.stringify(d || {})
        .toLowerCase()
        .includes(lowered),
    );
    setFiltered(results);
    setPage(1);
  }, [searchText, data]);

  const openEdit = async (record) => {
    setEditing(record);
    form.setFieldsValue({
      DTR_Record_Name: record.DTR_Record_Name,
      DTR_Cut_Off: [
        record?.DTR_Cut_Off?.start ? dayjs(record.DTR_Cut_Off.start) : null,
        record?.DTR_Cut_Off?.end ? dayjs(record.DTR_Cut_Off.end) : null,
      ],
      hiddenFromDropdown: record.hiddenFromDropdown !== false,
    });
    setEditModalOpen(true);
    setEditLogsSearch("");
    setEditSelectedRowKeys([]);
    setEditMoveTarget(null);

    // Reset preview table state; actual fetch happens in the watcher effect below.
    setEditLogs([]);
    setEditLogsTotal(0);
    setEditLogsPage(1);
    setEditLogsPageSize(10);
  };

  const loadEditLogs = async (p = editLogsPage, ps = editLogsPageSize) => {
    if (!editModalOpen) return;
    // Always use the original record name so typing in the rename field doesn't filter logs
    const rn = editing?.DTR_Record_Name;
    const co =
      watchedCutOff ??
      (editing?.DTR_Cut_Off
        ? [dayjs(editing.DTR_Cut_Off.start), dayjs(editing.DTR_Cut_Off.end)]
        : null);

    try {
      setEditLogsLoading(true);
      const dataRes = await fetchMergedLogs({
        recordName: rn,
        cutOff: co,
        page: p,
        limit: ps,
      });

      if (dataRes && dataRes.success) {
        setEditLogs(dataRes.data || []);
        setEditLogsTotal(
          typeof dataRes.total === "number"
            ? dataRes.total
            : (dataRes.data || []).length,
        );
      } else {
        setEditLogs([]);
        setEditLogsTotal(0);
      }
    } catch (err) {
      console.error("Failed to fetch DTR logs for edit modal", err);
      setEditLogs([]);
      setEditLogsTotal(0);
    } finally {
      setEditLogsLoading(false);
    }
  };

  // Keep preview in sync with the current form values (Record Name / Cut Off)
  useEffect(() => {
    if (!editModalOpen || !editing) return;
    setEditLogsPage(1);
    loadEditLogs(1, editLogsPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editModalOpen, editing?._id, watchedCutOff]);

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        DTR_Record_Name: (values.DTR_Record_Name || "").toString().trim(),
        DTR_Cut_Off: {
          start: values.DTR_Cut_Off[0].toDate().toISOString(),
          end: values.DTR_Cut_Off[1].toDate().toISOString(),
        },
        hiddenFromDropdown: !!values.hiddenFromDropdown,
      };

      await axiosInstance.put(`/dtrdatas/${editing._id}`, payload);
      swalSuccess("Updated");
      setEditModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      const msg = err?.response?.data?.message;
      swalError(msg ? `Update failed: ${msg}` : "Update failed");
    }
  };

  const handleDelete = async (id) => {
    // open preview modal and load sample
    const rec = data.find((r) => r._id === id) || null;
    if (!rec) return swalError("Record not found");
    setPreviewRecord(rec);
    setPreviewModalOpen(true);

    // Reset pagination when switching records
    setPreviewPage(1);
    setPreviewPageSize(5);
    setPreviewSample([]);
    setPreviewTotal(0);

    // fetch sample logs via merged endpoint (pageable)
    try {
      setPreviewLoading(true);
      const dataRes = await fetchMergedLogs({
        recordName: rec.DTR_Record_Name,
        cutOff: rec?.DTR_Cut_Off
          ? [dayjs(rec.DTR_Cut_Off.start), dayjs(rec.DTR_Cut_Off.end)]
          : null,
        page: 1,
        limit: 5,
      });
      if (dataRes && dataRes.success) {
        setPreviewSample(dataRes.data || []);
        setPreviewTotal(
          typeof dataRes.total === "number"
            ? dataRes.total
            : (dataRes.data || []).length,
        );
      } else {
        setPreviewSample([]);
        setPreviewTotal(0);
      }
    } catch (e) {
      console.error("Preview load failed", e);
      swalError("Failed to load preview samples");
      setPreviewSample([]);
      setPreviewTotal(0);
    } finally {
      setPreviewLoading(false);
    }
  };

  const startDeleteJob = async () => {
    if (!previewRecord) return;
    try {
      const res = await axiosInstance.delete(`/dtrdatas/${previewRecord._id}`);
      if (res.data && res.data.success && res.data.jobId) {
        setDeleteProgress({ status: "queued", total: 0, deleted: 0 });
        // start polling
        deletePollRef.current = setInterval(async () => {
          try {
            const p = await axiosInstance.get(
              `/dtrdatas/delete-progress/${res.data.jobId}`,
            );
            if (p.data && p.data.success) {
              setDeleteProgress(p.data.data || null);
              if (
                p.data.data &&
                (p.data.data.status === "done" ||
                  p.data.data.status === "error")
              ) {
                clearInterval(deletePollRef.current);
                deletePollRef.current = null;
                setTimeout(() => {
                  setPreviewModalOpen(false);
                }, 600);
                fetchData();
                if (p.data.data.status === "done")
                  swalSuccess(`Deleted ${p.data.data.deleted} logs`);
                else
                  swalError(`Delete failed: ${p.data.data.message || "error"}`);
              }
            }
          } catch (err) {
            console.warn("Delete progress poll error", err);
          }
        }, 1000);
      } else {
        swalError("Failed to start delete job");
      }
    } catch (err) {
      console.error("Start delete failed", err);
      swalError("Failed to start delete");
    }
  };

  useEffect(() => {
    return () => {
      if (deletePollRef.current) clearInterval(deletePollRef.current);
      if (mergePollRef.current) clearInterval(mergePollRef.current);
      if (unmergePollRef.current) clearInterval(unmergePollRef.current);
    };
  }, []);

  const exportCsv = () => {
    if (!data?.length) return swalWarning("No data to export");
    const rows = data.map((r) => ({
      DTR_Record_Name: r.DTR_Record_Name,
      CutOffStart: r.DTR_Cut_Off?.start
        ? dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD")
        : "",
      CutOffEnd: r.DTR_Cut_Off?.end
        ? dayjs(r.DTR_Cut_Off.end).format("YYYY-MM-DD")
        : "",
      Uploaded_By: r.Uploaded_By ?? "",
      Uploaded_Date: r.Uploaded_Date
        ? dayjs(r.Uploaded_Date).format("YYYY-MM-DD HH:mm:ss")
        : "",
    }));
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dtr_data_backup_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Merge handlers ──
  const openMerge = (record) => {
    setMergeTarget(record);
    setMergeSourceIds([]);
    setMergeStep("select");
    setMergePreview(null);
    setMergeProgress(null);
    setMergeJobId(null);
    setMergeModalOpen(true);
  };

  const closeMerge = () => {
    if (mergePollRef.current) {
      clearInterval(mergePollRef.current);
      mergePollRef.current = null;
    }
    setMergeModalOpen(false);
    setMergeTarget(null);
    setMergeSourceIds([]);
    setMergeStep("select");
    setMergePreview(null);
    setMergeProgress(null);
    setMergeJobId(null);
  };

  // Move selected logs from edit modal to another DTR Data record
  const editMoveTargetOptions = useMemo(() => {
    if (!editing) return [];
    return [...data]
      .filter((r) => r._id !== editing._id)
      .sort((a, b) => {
        const aStart = a.DTR_Cut_Off?.start
          ? new Date(a.DTR_Cut_Off.start).getTime()
          : 0;
        const bStart = b.DTR_Cut_Off?.start
          ? new Date(b.DTR_Cut_Off.start).getTime()
          : 0;
        return bStart - aStart;
      })
      .map((r) => ({
        label: `${r.DTR_Record_Name} (${r.DTR_Cut_Off?.start ? dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD") : "?"} → ${r.DTR_Cut_Off?.end ? dayjs(r.DTR_Cut_Off.end).format("YYYY-MM-DD") : "?"})`,
        value: r._id,
      }));
  }, [data, editing]);

  const handleMoveLogs = async () => {
    if (!editMoveTarget || !editSelectedRowKeys.length) return;
    try {
      setEditMoveLoading(true);
      const res = await axiosInstance.post(
        `/dtrdatas/${editMoveTarget}/move-logs`,
        {
          logIds: editSelectedRowKeys,
        },
      );
      if (res.data?.success) {
        swalSuccess(res.data.message || "Records moved successfully");
        setEditSelectedRowKeys([]);
        setEditMoveTarget(null);
        loadEditLogs(editLogsPage, editLogsPageSize);
      } else {
        swalError(res.data?.message || "Move failed");
      }
    } catch (err) {
      swalError(err.response?.data?.message || "Move failed");
    } finally {
      setEditMoveLoading(false);
    }
  };

  // Build options for merge source dropdown (exclude the target, sort by date)
  const mergeSourceOptions = useMemo(() => {
    if (!mergeTarget) return [];
    return [...data]
      .filter((r) => r._id !== mergeTarget._id)
      .sort((a, b) => {
        const aStart = a.DTR_Cut_Off?.start
          ? new Date(a.DTR_Cut_Off.start).getTime()
          : 0;
        const bStart = b.DTR_Cut_Off?.start
          ? new Date(b.DTR_Cut_Off.start).getTime()
          : 0;
        return bStart - aStart;
      })
      .map((r) => ({
        label: `${r.DTR_Record_Name} (${r.DTR_Cut_Off?.start ? dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD") : "?"} → ${r.DTR_Cut_Off?.end ? dayjs(r.DTR_Cut_Off.end).format("YYYY-MM-DD") : "?"})`,
        value: r._id,
      }));
  }, [data, mergeTarget]);

  // Filtered editLogs for search in edit modal
  const filteredEditLogs = useMemo(() => {
    if (!editLogsSearch) return editLogs;
    const q = editLogsSearch.toLowerCase();
    return editLogs.filter((row) => {
      const time = row.time ? dayjs(row.time).format("YYYY-MM-DD HH:mm") : "";
      const acNo = row.acNo || row.empId || row["AC-No"] || "";
      const state = row.state || "";
      const name = row.employeeName || row.name || "";
      return [time, String(acNo), state, name].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [editLogs, editLogsSearch]);

  const handleMergePreview = async () => {
    if (!mergeTarget || !mergeSourceIds.length) return;
    try {
      setMergePreviewLoading(true);
      const res = await axiosInstance.post(
        `/dtrdatas/${mergeTarget._id}/merge-preview`,
        {
          sourceIds: mergeSourceIds,
        },
      );
      if (res.data?.success) {
        setMergePreview(res.data.preview);
        setMergeStep("preview");
      } else {
        swalError(res.data?.message || "Preview failed");
      }
    } catch (err) {
      swalError(err.response?.data?.message || "Preview failed");
    } finally {
      setMergePreviewLoading(false);
    }
  };

  const handleMergeStart = async () => {
    if (!mergeTarget || !mergeSourceIds.length) return;
    try {
      setMergeLoading(true);
      const res = await axiosInstance.post(
        `/dtrdatas/${mergeTarget._id}/merge-start`,
        {
          sourceIds: mergeSourceIds,
        },
      );
      if (res.data?.success && res.data.jobId) {
        setMergeJobId(res.data.jobId);
        setMergeStep("progress");
        setMergeProgress({
          status: "running",
          total: 0,
          processed: 0,
          moved: 0,
          overwritten: 0,
        });

        // Start polling
        mergePollRef.current = setInterval(async () => {
          try {
            const p = await axiosInstance.get(
              `/dtrdatas/merge-progress/${res.data.jobId}`,
            );
            if (p.data?.success) {
              setMergeProgress(p.data.data);
              if (
                ["done", "error", "cancelled"].includes(p.data.data?.status)
              ) {
                clearInterval(mergePollRef.current);
                mergePollRef.current = null;
                setMergeLoading(false);
                if (p.data.data.status === "done") {
                  setMergeStep("done");
                  fetchData();
                } else if (p.data.data.status === "cancelled") {
                  swalWarning(
                    "Merge was cancelled. Some records may have already been merged.",
                  );
                  fetchData();
                } else {
                  swalError(`Merge failed: ${p.data.data.message || "error"}`);
                }
              }
            }
          } catch {
            // keep polling
          }
        }, 800);
      } else {
        swalError("Failed to start merge");
        setMergeLoading(false);
      }
    } catch (err) {
      swalError(err.response?.data?.message || "Merge failed");
      setMergeLoading(false);
    }
  };

  const handleMergeCancel = async () => {
    if (!mergeJobId) return;
    try {
      await axiosInstance.post(`/dtrdatas/merge-cancel/${mergeJobId}`);
    } catch {
      // will be handled by progress polling
    }
  };

  // ── Container helpers ──────────────────────────────────────────
  const getContainerDateRange = (type, year, periodVal) => {
    if (type === "quarter") {
      const q = periodVal || 1;
      const startMonth = (q - 1) * 3;
      return [
        dayjs().year(year).month(startMonth).startOf("month"),
        dayjs()
          .year(year)
          .month(startMonth + 2)
          .endOf("month"),
      ];
    }
    if (type === "semester") {
      const startMonth = periodVal === 1 ? 0 : 6;
      return [
        dayjs().year(year).month(startMonth).startOf("month"),
        dayjs()
          .year(year)
          .month(startMonth + 5)
          .endOf("month"),
      ];
    }
    // year
    return [
      dayjs().year(year).month(0).startOf("month"),
      dayjs().year(year).month(11).endOf("month"),
    ];
  };

  const getContainerLabel = (type, year, periodVal) => {
    if (type === "quarter") return `Q${periodVal} ${year}`;
    if (type === "semester")
      return `${periodVal === 1 ? "1st" : "2nd"} Half ${year}`;
    return `${year} Annual`;
  };

  const openContainerModal = () => {
    setContainerStep("select");
    setContainerPeriodType("quarter");
    setContainerYear(dayjs().year());
    setContainerPeriodValue(1);
    setContainerPreview(null);
    setContainerSelectedIds([]);
    setContainerJobId(null);
    setContainerProgress(null);
    setContainerDeleteSources(true);
    setContainerModalOpen(true);
  };

  const closeContainerModal = () => {
    if (containerPollRef.current) {
      clearInterval(containerPollRef.current);
      containerPollRef.current = null;
    }
    setContainerModalOpen(false);
  };

  const handleContainerPreview = async () => {
    const [start, end] = getContainerDateRange(
      containerPeriodType,
      containerYear,
      containerPeriodValue,
    );
    const containerName = getContainerLabel(
      containerPeriodType,
      containerYear,
      containerPeriodValue,
    );
    try {
      setContainerPreviewLoading(true);
      const res = await axiosInstance.post("/dtrdatas/container-preview", {
        containerName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      if (res.data?.success) {
        setContainerPreview(res.data.preview);
        setContainerSelectedIds(res.data.preview.records.map((r) => r._id));
        setContainerStep("preview");
      } else {
        swalError(res.data?.message || "Preview failed");
      }
    } catch (err) {
      swalError(err.response?.data?.message || "Preview failed");
    } finally {
      setContainerPreviewLoading(false);
    }
  };

  const handleContainerCreate = async () => {
    if (!containerPreview || !containerSelectedIds.length) return;
    try {
      const res = await axiosInstance.post("/dtrdatas/container-create", {
        containerName: containerPreview.containerName,
        startDate: containerPreview.startDate,
        endDate: containerPreview.endDate,
        sourceIds: containerSelectedIds,
        deleteSourceRecords: containerDeleteSources,
      });
      if (res.data?.success && res.data.jobId) {
        setContainerJobId(res.data.jobId);
        setContainerStep("progress");
        setContainerProgress({
          status: "running",
          total: 0,
          moved: 0,
          phase: "creating",
        });

        containerPollRef.current = setInterval(async () => {
          try {
            const p = await axiosInstance.get(
              `/dtrdatas/container-progress/${res.data.jobId}`,
            );
            if (p.data?.success) {
              setContainerProgress(p.data.data);
              if (
                ["done", "error", "cancelled"].includes(p.data.data?.status)
              ) {
                clearInterval(containerPollRef.current);
                containerPollRef.current = null;
                if (p.data.data.status === "done") {
                  setContainerStep("done");
                  fetchData();
                } else {
                  swalError(
                    `Container creation failed: ${p.data.data.message || "error"}`,
                  );
                }
              }
            }
          } catch {
            // keep polling
          }
        }, 800);
      } else {
        swalError("Failed to start container creation");
      }
    } catch (err) {
      swalError(err.response?.data?.message || "Container creation failed");
    }
  };

  // ── Unmerge handlers ──────────────────────────────────────────
  const openUnmerge = (record) => {
    setUnmergeContainer(record);
    setUnmergeStep("select");
    setUnmergeJobId(null);
    setUnmergeProgress(null);
    setUnmergeDateRange(null);
    setUnmergeRecordName("");
    setUnmergeModalOpen(true);
  };

  const closeUnmerge = () => {
    if (unmergePollRef.current) {
      clearInterval(unmergePollRef.current);
      unmergePollRef.current = null;
    }
    setUnmergeModalOpen(false);
    setUnmergeContainer(null);
    setUnmergeStep("select");
    setUnmergeJobId(null);
    setUnmergeProgress(null);
    setUnmergeDateRange(null);
    setUnmergeRecordName("");
  };

  const handleUnmergeStart = async () => {
    if (!unmergeContainer || !unmergeDateRange || !unmergeRecordName.trim()) return;
    try {
      const res = await axiosInstance.post(
        `/dtrdatas/${unmergeContainer._id}/unmerge`,
        {
          startDate: unmergeDateRange[0].toISOString(),
          endDate: unmergeDateRange[1].toISOString(),
          newRecordName: unmergeRecordName.trim(),
        },
      );
      if (res.data?.success && res.data.jobId) {
        setUnmergeJobId(res.data.jobId);
        setUnmergeStep("progress");
        setUnmergeProgress({ status: "running", total: 0, moved: 0, phase: "creating" });

        unmergePollRef.current = setInterval(async () => {
          try {
            const p = await axiosInstance.get(
              `/dtrdatas/unmerge-progress/${res.data.jobId}`,
            );
            if (p.data?.success) {
              setUnmergeProgress(p.data.data);
              if (["done", "error", "cancelled"].includes(p.data.data?.status)) {
                clearInterval(unmergePollRef.current);
                unmergePollRef.current = null;
                if (p.data.data.status === "done") {
                  setUnmergeStep("done");
                  fetchData();
                } else if (p.data.data.status === "cancelled") {
                  setUnmergeStep("cancelled");
                  fetchData();
                } else {
                  swalError(`Unmerge failed: ${p.data.data.message || "error"}`);
                  closeUnmerge();
                }
              }
            }
          } catch {
            // keep polling
          }
        }, 800);
      } else {
        swalError("Failed to start unmerge");
      }
    } catch (err) {
      swalError(err.response?.data?.message || "Unmerge failed");
    }
  };

  const handleUnmergeCancel = async () => {
    if (!unmergeJobId) return;
    try {
      await axiosInstance.post(`/dtrdatas/unmerge-cancel/${unmergeJobId}`);
    } catch {
      // will be handled by progress polling
    }
  };

  const columns = [
    { title: "Record Name", dataIndex: "DTR_Record_Name", key: "name" },
    {
      title: "Cut Off",
      key: "cutoff",
      render: (r) =>
        r?.DTR_Cut_Off
          ? `${dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD")} → ${dayjs(
              r.DTR_Cut_Off.end,
            ).format("YYYY-MM-DD")}`
          : "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size={4} wrap>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Merge">
            <Button
              icon={<MergeCellsOutlined />}
              size="small"
              onClick={() => openMerge(record)}
            />
          </Tooltip>
          {(record.isContainer || record.childPeriods?.length > 0) && (
            <Tooltip title="Unmerge">
              <Button
                icon={<SplitCellsOutlined />}
                size="small"
                onClick={() => openUnmerge(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => handleDelete(record._id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Slice filtered for pagination (client-side because endpoint returns full list)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="compact-table">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Space size={8} wrap align="center">
          <Input
            size="small"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
            style={{ minWidth: 200 }}
          />
          <DatePicker.RangePicker
            size="small"
            value={dateRange}
            onChange={(val) => {
              setDateRange(val);
              fetchData(val);
            }}
            allowEmpty={[true, true]}
          />
          <Button
            size="small"
            onClick={() => {
              setSearchText("");
              setDateRange(null);
              fetchData(null);
            }}
          >
            Clear Filters
          </Button>
        </Space>
        <Space size={8}>
          <Button
            size="small"
            icon={<FolderAddOutlined />}
            onClick={openContainerModal}
          >
            Create Container
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv}>
            Export CSV
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={paginated}
        rowKey={(r) => r._id}
        loading={loading}
        size="small"
        className="compact-table"
        pagination={{
          current: page,
          pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
          showTotal: (t, range) => `${range[0]}-${range[1]} of ${t}`,
          onChange: (p, ps) => {
            if (ps !== pageSize) {
              setPageSize(ps);
              setPage(1);
            } else {
              setPage(p);
            }
          },
        }}
      />

      <Modal
        title={
          previewRecord
            ? `Preview: ${previewRecord.DTR_Record_Name}`
            : "Preview"
        }
        open={previewModalOpen}
        onCancel={() => {
          setPreviewModalOpen(false);
          if (deletePollRef.current) {
            clearInterval(deletePollRef.current);
            deletePollRef.current = null;
          }
        }}
        footer={
          previewLoading
            ? null
            : [
                <Button key="cancel" onClick={() => setPreviewModalOpen(false)}>
                  Cancel
                </Button>,
                <Button key="delete" danger onClick={startDeleteJob}>
                  Confirm Delete
                </Button>,
              ]
        }
        width={800}
      >
        {previewLoading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <div>
            <p>
              This will delete the biometric logs associated with the selected
              cut-off.
              <br />
              Total logs found: <b>{previewTotal}</b>
            </p>

            {deleteProgress ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 6 }}>
                  Status: <b>{deleteProgress.status}</b>
                </div>
                <Progress
                  percent={
                    deleteProgress.total > 0
                      ? Math.round(
                          (deleteProgress.deleted / deleteProgress.total) * 100,
                        )
                      : 0
                  }
                  status={
                    deleteProgress.status === "error"
                      ? "exception"
                      : deleteProgress.status === "done"
                        ? "success"
                        : "active"
                  }
                />
                <div style={{ marginTop: 6 }}>
                  Deleted: {deleteProgress.deleted} / {deleteProgress.total}
                </div>
              </div>
            ) : null}

            <Table
              dataSource={previewSample}
              size="small"
              rowKey={(r) => r.no || r.empId || JSON.stringify(r)}
              style={{ fontSize: 11 }}
              className="compact-modal-table"
              pagination={{
                current: previewPage,
                pageSize: previewPageSize,
                total: previewTotal,
                onChange: async (p, ps) => {
                  const nextPage = ps !== previewPageSize ? 1 : p;
                  setPreviewPage(nextPage);
                  setPreviewPageSize(ps);
                  // refetch sample for new page/size
                  if (previewRecord) {
                    try {
                      setPreviewLoading(true);
                      const dataRes = await fetchMergedLogs({
                        recordName: previewRecord.DTR_Record_Name,
                        cutOff: previewRecord?.DTR_Cut_Off
                          ? [
                              dayjs(previewRecord.DTR_Cut_Off.start),
                              dayjs(previewRecord.DTR_Cut_Off.end),
                            ]
                          : null,
                        page: nextPage,
                        limit: ps,
                      });
                      if (dataRes && dataRes.success) {
                        setPreviewSample(dataRes.data || []);
                        setPreviewTotal(
                          typeof dataRes.total === "number"
                            ? dataRes.total
                            : (dataRes.data || []).length,
                        );
                      } else {
                        setPreviewSample([]);
                        setPreviewTotal(0);
                      }
                    } catch (e) {
                      console.error("Preview page load failed", e);
                    } finally {
                      setPreviewLoading(false);
                    }
                  }
                },
                showSizeChanger: true,
                pageSizeOptions: ["5", "10", "20"],
              }}
              columns={[
                {
                  title: "Time",
                  dataIndex: "time",
                  key: "time",
                  render: (t) => (t ? dayjs(t).format("YYYY-MM-DD HH:mm") : t),
                },
                {
                  title: "AC-No",
                  key: "acNo",
                  render: (_, row) => {
                    // prefer explicit acNo, fallback to empId or heuristic
                    const ac = row.acNo || row.empId || row["AC-No"] || "";
                    // If ac looks like a name but employeeName looks numeric, swap
                    const emp = row.employeeName || row.name || "";
                    const acLooksAlpha = /[A-Za-z\s]/.test(String(ac));
                    const empLooksDigits = /^\d+$/.test(
                      String(emp).replace(/\D/g, ""),
                    );
                    if ((ac === "" || acLooksAlpha) && empLooksDigits)
                      return emp;
                    return ac || "-";
                  },
                },
                { title: "State", dataIndex: "state", key: "state" },
                {
                  title: "Employee",
                  key: "employeeName",
                  render: (_, row) => {
                    // Use raw biometric Name as primary display. Show matched employee (if any) as tooltip/secondary.
                    const rawName = row.name || row.employeeName || "-";
                    const matched =
                      row.employeeName && row.employeeName !== row.name
                        ? row.employeeName
                        : null;
                    if (matched) {
                      return (
                        <Tooltip title={`Matched employee: ${matched}`}>
                          <span>{rawName}</span>
                        </Tooltip>
                      );
                    }
                    return rawName;
                  },
                },
              ]}
            />
          </div>
        )}
      </Modal>

      <Modal
        title={`Edit DTR Data${editing ? `: ${editing.DTR_Record_Name}` : ""}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={saveEdit}
        okText="Save"
        width={900}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="DTR_Record_Name"
            label="Record Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="DTR_Cut_Off"
            label="Cut Off (start - end)"
            rules={[{ required: true }]}
          >
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item
            name="hiddenFromDropdown"
            label="Hide from Generate DTR & Biometrics Logs dropdowns"
            valuePropName="checked"
          >
            <Switch checkedChildren="Hidden" unCheckedChildren="Visible" />
          </Form.Item>
        </Form>

        {/* DTR Logs Table */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0 }}>DTR Records Preview</h4>
            <Input
              size="small"
              placeholder="Search records..."
              prefix={<SearchOutlined />}
              allowClear
              value={editLogsSearch}
              onChange={(e) => setEditLogsSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>

          {/* Move selected records tool */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <Button
              size="small"
              onClick={() => {
                if (editSelectedRowKeys.length === editLogsTotal && editLogsTotal > 0) {
                  setEditSelectedRowKeys([]);
                } else {
                  // Fetch all log IDs across all pages
                  (async () => {
                    try {
                      const rn = editing?.DTR_Record_Name;
                      const co = watchedCutOff ?? (editing?.DTR_Cut_Off
                        ? [dayjs(editing.DTR_Cut_Off.start), dayjs(editing.DTR_Cut_Off.end)]
                        : null);
                      const allRes = await fetchMergedLogs({ recordName: rn, cutOff: co, page: 1, limit: editLogsTotal || 99999 });
                      const allIds = (allRes?.data || []).map((r) => r._id).filter(Boolean);
                      setEditSelectedRowKeys(allIds);
                    } catch {
                      swalError("Failed to select all records");
                    }
                  })();
                }
              }}
            >
              {editSelectedRowKeys.length === editLogsTotal && editLogsTotal > 0
                ? "Deselect All"
                : `Select All (${editLogsTotal.toLocaleString()})`}
            </Button>
            <Select
              size="small"
              placeholder="Move selected records to..."
              style={{ flex: 1, minWidth: 200 }}
              value={editMoveTarget}
              onChange={setEditMoveTarget}
              options={editMoveTargetOptions}
              allowClear
              showSearch
              filterOption={(input, opt) =>
                (opt?.label || "").toLowerCase().includes(input.toLowerCase())
              }
            />
            <Button
              size="small"
              type="primary"
              icon={<MergeCellsOutlined />}
              loading={editMoveLoading}
              disabled={!editMoveTarget || !editSelectedRowKeys.length}
              onClick={handleMoveLogs}
            >
              Move{" "}
              {editSelectedRowKeys.length > 0
                ? `(${editSelectedRowKeys.length})`
                : ""}
            </Button>
          </div>

          <Table
            dataSource={filteredEditLogs}
            size="small"
            rowKey={(r) => r._id || r.no || r.empId || JSON.stringify(r)}
            loading={editLogsLoading}
            style={{ fontSize: 11 }}
            className="compact-modal-table"
            rowSelection={{
              selectedRowKeys: editSelectedRowKeys,
              onChange: (keys) => setEditSelectedRowKeys(keys),
            }}
            pagination={{
              current: editLogsPage,
              pageSize: editLogsPageSize,
              total: editLogsSearch ? filteredEditLogs.length : editLogsTotal,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20"],
              onChange: async (p, ps) => {
                const nextPage = ps !== editLogsPageSize ? 1 : p;
                setEditLogsPage(nextPage);
                setEditLogsPageSize(ps);
                await loadEditLogs(nextPage, ps);
              },
            }}
            columns={[
              {
                title: "Time",
                dataIndex: "time",
                key: "time",
                render: (t) => (t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "-"),
              },
              {
                title: "AC-No",
                key: "acNo",
                render: (_, row) => row.acNo || row.empId || "-",
              },
              { title: "State", dataIndex: "state", key: "state" },
              {
                title: "Employee",
                dataIndex: "employeeName",
                key: "employeeName",
              },
            ]}
          />
        </div>
      </Modal>

      {/* ── Merge Modal ── */}
      <Modal
        title={
          <Space>
            <MergeCellsOutlined />
            <span>
              {mergeStep === "select" &&
                `Merge Time Records into: ${mergeTarget?.DTR_Record_Name}`}
              {mergeStep === "preview" && "Merge Preview"}
              {mergeStep === "progress" && "Merging in Progress..."}
              {mergeStep === "done" && "Merge Complete"}
            </span>
          </Space>
        }
        open={mergeModalOpen}
        onCancel={mergeStep === "progress" ? undefined : closeMerge}
        closable={mergeStep !== "progress"}
        maskClosable={mergeStep !== "progress"}
        footer={
          mergeStep === "select"
            ? [
                <Button key="cancel" onClick={closeMerge}>
                  Cancel
                </Button>,
                <Button
                  key="preview"
                  type="primary"
                  loading={mergePreviewLoading}
                  disabled={!mergeSourceIds.length}
                  onClick={handleMergePreview}
                >
                  Preview Merge
                </Button>,
              ]
            : mergeStep === "preview"
              ? [
                  <Button key="back" onClick={() => setMergeStep("select")}>
                    Back
                  </Button>,
                  <Button
                    key="start"
                    type="primary"
                    danger
                    icon={<MergeCellsOutlined />}
                    onClick={handleMergeStart}
                  >
                    Start Merge
                  </Button>,
                ]
              : mergeStep === "progress"
                ? [
                    <Button key="cancel" danger onClick={handleMergeCancel}>
                      Cancel / Abort Merge
                    </Button>,
                  ]
                : [
                    <Button
                      key="close"
                      type="primary"
                      onClick={() => {
                        closeMerge();
                      }}
                    >
                      Close
                    </Button>,
                  ]
        }
        width={800}
      >
        {/* Step 1: Select Sources */}
        {mergeStep === "select" && mergeTarget && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>Target Record:</strong>{" "}
              <Tag color="blue">{mergeTarget.DTR_Record_Name}</Tag>
              {mergeTarget.DTR_Cut_Off && (
                <Tag>
                  {dayjs(mergeTarget.DTR_Cut_Off.start).format("YYYY-MM-DD")} →{" "}
                  {dayjs(mergeTarget.DTR_Cut_Off.end).format("YYYY-MM-DD")}
                </Tag>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{ display: "block", marginBottom: 6, fontWeight: 500 }}
              >
                Select source record(s) to merge into this record:
              </label>
              <Select
                mode="multiple"
                placeholder="Select DTR Data records to merge from..."
                style={{ width: "100%" }}
                value={mergeSourceIds}
                onChange={setMergeSourceIds}
                options={mergeSourceOptions}
                maxTagCount={3}
                allowClear
              />
            </div>
            <Alert
              type="info"
              showIcon
              message="How merging works"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>
                    All time records from the selected source record(s) will be
                    moved into the target record.
                  </li>
                  <li>
                    If a duplicate exists (same AC-No and exact timestamp), the
                    source record&apos;s data <strong>overwrites</strong> the
                    target.
                  </li>
                  <li>
                    After merging, the source DTR Data record(s) will be{" "}
                    <strong>deleted</strong>.
                  </li>
                </ul>
              }
            />
          </div>
        )}

        {/* Step 2: Preview */}
        {mergeStep === "preview" && mergePreview && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <Card size="small" style={{ flex: 1, minWidth: 150 }}>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 24, fontWeight: 700, color: "#1677ff" }}
                  >
                    {mergePreview.existingCount}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    Existing Records in Target
                  </div>
                </div>
              </Card>
              <Card size="small" style={{ flex: 1, minWidth: 150 }}>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 24, fontWeight: 700, color: "#52c41a" }}
                  >
                    {mergePreview.newCount}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    New Records to Import
                  </div>
                </div>
              </Card>
              <Card size="small" style={{ flex: 1, minWidth: 150 }}>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 24, fontWeight: 700, color: "#faad14" }}
                  >
                    {mergePreview.overwriteCount}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    Duplicates to Overwrite
                  </div>
                </div>
              </Card>
            </div>

            {mergePreview.sampleNewLogs.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 6 }}>
                  <Tag color="green">New Records</Tag> (sample, up to 50)
                </h4>
                <Table
                  dataSource={mergePreview.sampleNewLogs}
                  size="small"
                  rowKey={(r, i) => `new-${i}`}
                  pagination={false}
                  scroll={{ y: 120 }}
                  columns={[
                    {
                      title: "AC-No",
                      dataIndex: "acNo",
                      key: "acNo",
                      width: 80,
                    },
                    {
                      title: "Time",
                      dataIndex: "time",
                      key: "time",
                      width: 140,
                      render: (t) =>
                        t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "-",
                    },
                    {
                      title: "State",
                      dataIndex: "state",
                      key: "state",
                      width: 60,
                    },
                    { title: "Name", dataIndex: "name", key: "name" },
                    {
                      title: "Source",
                      dataIndex: "source",
                      key: "source",
                      width: 120,
                    },
                  ]}
                  rowClassName={() => "merge-preview-new-row"}
                />
              </div>
            )}

            {mergePreview.sampleOverwriteLogs.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 6 }}>
                  <Tag color="orange">Overwrite Records</Tag> (sample, up to 50)
                </h4>
                <Table
                  dataSource={mergePreview.sampleOverwriteLogs}
                  size="small"
                  rowKey={(r, i) => `ow-${i}`}
                  pagination={false}
                  scroll={{ y: 120 }}
                  columns={[
                    {
                      title: "AC-No",
                      dataIndex: "acNo",
                      key: "acNo",
                      width: 80,
                    },
                    {
                      title: "Time",
                      dataIndex: "time",
                      key: "time",
                      width: 140,
                      render: (t) =>
                        t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "-",
                    },
                    {
                      title: "State",
                      dataIndex: "state",
                      key: "state",
                      width: 60,
                    },
                    { title: "Name", dataIndex: "name", key: "name" },
                    {
                      title: "Source",
                      dataIndex: "source",
                      key: "source",
                      width: 120,
                    },
                  ]}
                  rowClassName={() => "merge-preview-overwrite-row"}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Progress */}
        {mergeStep === "progress" && mergeProgress && (
          <div style={{ padding: "16px 0" }}>
            <div style={{ marginBottom: 12, textAlign: "center" }}>
              <Spin />
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                Merging records... Please do not close this window.
              </div>
            </div>
            <Progress
              percent={
                mergeProgress.total > 0
                  ? Math.round(
                      (mergeProgress.processed / mergeProgress.total) * 100,
                    )
                  : 0
              }
              status="active"
              format={(p) => `${p}%`}
            />
            <div
              style={{
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "#888",
              }}
            >
              <span>
                Processed: {mergeProgress.processed} / {mergeProgress.total}
              </span>
              <span>
                Moved: {mergeProgress.moved} | Overwritten:{" "}
                {mergeProgress.overwritten}
              </span>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {mergeStep === "done" && mergeProgress && (
          <div>
            <Alert
              type="success"
              showIcon
              message="Merge completed successfully!"
              description={`Moved: ${mergeProgress.moved} records | Overwritten: ${mergeProgress.overwritten} duplicates | Total processed: ${mergeProgress.processed}`}
              style={{ marginBottom: 16 }}
            />
            {mergeProgress.mergedLogs?.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 6 }}>Merged Records (up to 100)</h4>
                <Table
                  dataSource={mergeProgress.mergedLogs}
                  size="small"
                  rowKey={(r, i) => `merged-${i}`}
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50"],
                  }}
                  scroll={{ y: 180 }}
                  columns={[
                    {
                      title: "AC-No",
                      dataIndex: "acNo",
                      key: "acNo",
                      width: 80,
                    },
                    {
                      title: "Time",
                      dataIndex: "time",
                      key: "time",
                      width: 140,
                      render: (t) =>
                        t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "-",
                    },
                    {
                      title: "State",
                      dataIndex: "state",
                      key: "state",
                      width: 60,
                    },
                    { title: "Name", dataIndex: "name", key: "name" },
                    {
                      title: "Source",
                      dataIndex: "source",
                      key: "source",
                      width: 120,
                    },
                  ]}
                  rowClassName={(record) =>
                    record.isNew
                      ? "merge-result-new-row"
                      : "merge-result-existing-row"
                  }
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Container Modal ── */}
      <Modal
        title="Create DTR Data Container"
        open={containerModalOpen}
        onCancel={closeContainerModal}
        width={720}
        destroyOnClose
        footer={
          containerStep === "select" ? (
            <Space>
              <Button onClick={closeContainerModal}>Cancel</Button>
              <Button
                type="primary"
                loading={containerPreviewLoading}
                onClick={handleContainerPreview}
              >
                Preview Records
              </Button>
            </Space>
          ) : containerStep === "preview" ? (
            <Space>
              <Button onClick={() => setContainerStep("select")}>Back</Button>
              <Button
                type="primary"
                disabled={!containerSelectedIds.length}
                onClick={handleContainerCreate}
              >
                Create Container ({containerSelectedIds.length} record
                {containerSelectedIds.length !== 1 ? "s" : ""})
              </Button>
            </Space>
          ) : containerStep === "done" ? (
            <Button
              type="primary"
              onClick={() => {
                closeContainerModal();
              }}
            >
              Close
            </Button>
          ) : null
        }
      >
        {/* Step 1: Select period */}
        {containerStep === "select" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{ fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Period Type
              </label>
              <Select
                value={containerPeriodType}
                onChange={(v) => {
                  setContainerPeriodType(v);
                  setContainerPeriodValue(1);
                }}
                style={{ width: 200 }}
                options={[
                  { value: "quarter", label: "Quarter" },
                  { value: "semester", label: "Semester (6 months)" },
                  { value: "year", label: "Full Year" },
                ]}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{ fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Year
              </label>
              <Select
                value={containerYear}
                onChange={setContainerYear}
                style={{ width: 120 }}
                options={Array.from({ length: 10 }, (_, i) => {
                  const y = dayjs().year() - i;
                  return { value: y, label: String(y) };
                })}
              />
            </div>
            {containerPeriodType === "quarter" && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{ fontWeight: 600, display: "block", marginBottom: 4 }}
                >
                  Quarter
                </label>
                <Select
                  value={containerPeriodValue}
                  onChange={setContainerPeriodValue}
                  style={{ width: 200 }}
                  options={[
                    { value: 1, label: "Q1 (Jan – Mar)" },
                    { value: 2, label: "Q2 (Apr – Jun)" },
                    { value: 3, label: "Q3 (Jul – Sep)" },
                    { value: 4, label: "Q4 (Oct – Dec)" },
                  ]}
                />
              </div>
            )}
            {containerPeriodType === "semester" && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{ fontWeight: 600, display: "block", marginBottom: 4 }}
                >
                  Semester
                </label>
                <Select
                  value={containerPeriodValue}
                  onChange={setContainerPeriodValue}
                  style={{ width: 200 }}
                  options={[
                    { value: 1, label: "1st Half (Jan – Jun)" },
                    { value: 2, label: "2nd Half (Jul – Dec)" },
                  ]}
                />
              </div>
            )}
            <div
              style={{
                padding: "8px 12px",
                background: "#f5f5f5",
                borderRadius: 6,
              }}
            >
              <strong>Container Name: </strong>
              {getContainerLabel(
                containerPeriodType,
                containerYear,
                containerPeriodValue,
              )}
              <br />
              <strong>Date Range: </strong>
              {(() => {
                const [s, e] = getContainerDateRange(
                  containerPeriodType,
                  containerYear,
                  containerPeriodValue,
                );
                return `${s.format("YYYY-MM-DD")} → ${e.format("YYYY-MM-DD")}`;
              })()}
            </div>
          </div>
        )}

        {/* Step 2: Preview matching records */}
        {containerStep === "preview" && containerPreview && (
          <div>
            <Alert
              type="info"
              showIcon
              message={`Found ${containerPreview.totalRecords} record(s) with ${containerPreview.totalLogs.toLocaleString()} time log(s)`}
              description={`Container: ${containerPreview.containerName} (${dayjs(containerPreview.startDate).format("YYYY-MM-DD")} → ${dayjs(containerPreview.endDate).format("YYYY-MM-DD")})`}
              style={{ marginBottom: 12 }}
            />
            {containerPreview.totalRecords === 0 ? (
              <Alert
                type="warning"
                showIcon
                message="No DTR Data records found for this period."
              />
            ) : (
              <>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  Select records to include:
                </div>
                <Table
                  dataSource={containerPreview.records}
                  rowKey="_id"
                  size="small"
                  scroll={{ y: 200 }}
                  pagination={false}
                  rowSelection={{
                    selectedRowKeys: containerSelectedIds,
                    onChange: setContainerSelectedIds,
                  }}
                  columns={[
                    {
                      title: "Record Name",
                      dataIndex: "DTR_Record_Name",
                      key: "name",
                    },
                    {
                      title: "Cut Off",
                      key: "cutoff",
                      width: 200,
                      render: (r) =>
                        r?.DTR_Cut_Off
                          ? `${dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD")} → ${dayjs(r.DTR_Cut_Off.end).format("YYYY-MM-DD")}`
                          : "-",
                    },
                    {
                      title: "Logs",
                      dataIndex: "logCount",
                      key: "logCount",
                      width: 80,
                      align: "right",
                    },
                  ]}
                />
                <div style={{ marginTop: 12 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={containerDeleteSources}
                      onChange={(e) =>
                        setContainerDeleteSources(e.target.checked)
                      }
                      style={{ marginRight: 6 }}
                    />
                    Delete source records after consolidation
                  </label>
                </div>
                {containerPreview.sampleLogs?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Sample Time Records (up to 50)
                    </div>
                    <Table
                      dataSource={containerPreview.sampleLogs}
                      rowKey={(r, i) => `sample-${i}`}
                      size="small"
                      scroll={{ y: 150 }}
                      pagination={false}
                      columns={[
                        {
                          title: "AC-No",
                          dataIndex: "acNo",
                          key: "acNo",
                          width: 80,
                        },
                        {
                          title: "Time",
                          dataIndex: "time",
                          key: "time",
                          width: 150,
                          render: (t) =>
                            t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "-",
                        },
                        {
                          title: "State",
                          dataIndex: "state",
                          key: "state",
                          width: 60,
                        },
                        { title: "Name", dataIndex: "name", key: "name" },
                        {
                          title: "Source",
                          dataIndex: "source",
                          key: "source",
                          width: 130,
                        },
                      ]}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Progress */}
        {containerStep === "progress" && containerProgress && (
          <div style={{ padding: "16px 0" }}>
            <div style={{ marginBottom: 12, textAlign: "center" }}>
              <Spin />
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                {containerProgress.phase === "creating"
                  ? "Creating container record..."
                  : containerProgress.phase === "cleanup"
                    ? "Cleaning up source records..."
                    : "Moving time records... Please do not close this window."}
              </div>
            </div>
            <Progress
              percent={
                containerProgress.total > 0
                  ? Math.round(
                      (containerProgress.moved / containerProgress.total) * 100,
                    )
                  : 0
              }
              status="active"
              format={(p) => `${p}%`}
            />
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#888",
                textAlign: "center",
              }}
            >
              Moved: {containerProgress.moved?.toLocaleString()} /{" "}
              {containerProgress.total?.toLocaleString()}
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {containerStep === "done" && containerProgress && (
          <div>
            <Alert
              type="success"
              showIcon
              message="Container created successfully!"
              description={`"${containerProgress.containerName}" — Moved ${containerProgress.moved?.toLocaleString()} time record(s).${containerProgress.deletedSources ? ` Removed ${containerProgress.deletedSources} source record(s).` : ""}`}
              style={{ marginBottom: 12 }}
            />
          </div>
        )}
      </Modal>

      {/* ── Unmerge Modal ─────────────────────────────────────── */}
      <Modal
        title={
          unmergeContainer
            ? `Unmerge: ${unmergeContainer.DTR_Record_Name}`
            : "Unmerge"
        }
        open={unmergeModalOpen}
        onCancel={closeUnmerge}
        footer={
          unmergeStep === "done" || unmergeStep === "cancelled"
            ? [
                <Button key="close" type="primary" onClick={closeUnmerge}>
                  Close
                </Button>,
              ]
            : unmergeStep === "progress"
              ? [
                  <Button key="abort" danger onClick={handleUnmergeCancel}>
                    Cancel / Abort Unmerge
                  </Button>,
                ]
              : [
                  <Button key="cancel" onClick={closeUnmerge}>
                    Cancel
                  </Button>,
                  <Button
                    key="start"
                    type="primary"
                    danger
                    icon={<SplitCellsOutlined />}
                    disabled={!unmergeDateRange || !unmergeRecordName.trim()}
                    onClick={handleUnmergeStart}
                  >
                    Start Unmerge
                  </Button>,
                ]
        }
        width={600}
        maskClosable={unmergeStep === "select"}
      >
        {/* Step 1: Set cut-off range */}
        {unmergeStep === "select" && unmergeContainer && (
          <div>
            <div style={{ marginBottom: 16, color: "#666" }}>
              Set the cut-off date range and record name for the records you want to pull out of this container.
            </div>
            {unmergeContainer.DTR_Cut_Off && (
              <div style={{ marginBottom: 12, fontSize: 12, color: "#999" }}>
                Container range:{" "}
                {dayjs(unmergeContainer.DTR_Cut_Off.start).format("YYYY-MM-DD")} →{" "}
                {dayjs(unmergeContainer.DTR_Cut_Off.end).format("YYYY-MM-DD")}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                New Record Name
              </label>
              <Input
                placeholder="e.g. Jul 1-31, 2025 Biometrics"
                value={unmergeRecordName}
                onChange={(e) => setUnmergeRecordName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                Cut-Off Date Range
              </label>
              <DatePicker.RangePicker
                style={{ width: "100%" }}
                value={unmergeDateRange}
                onChange={(val) => setUnmergeDateRange(val)}
              />
            </div>
          </div>
        )}

        {/* Step 2: Progress */}
        {unmergeStep === "progress" && unmergeProgress && (
          <div style={{ padding: "16px 0" }}>
            <div style={{ marginBottom: 12, textAlign: "center" }}>
              <Spin />
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                {unmergeProgress.phase === "creating"
                  ? "Creating standalone record..."
                  : "Moving time records... Please do not close this window."}
              </div>
            </div>
            <Progress
              percent={
                unmergeProgress.total > 0
                  ? Math.round(
                      (unmergeProgress.moved / unmergeProgress.total) * 100,
                    )
                  : 0
              }
              status="active"
              format={(p) => `${p}%`}
            />
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#888",
                textAlign: "center",
              }}
            >
              Moved: {unmergeProgress.moved?.toLocaleString()} /{" "}
              {unmergeProgress.total?.toLocaleString()}
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {unmergeStep === "done" && unmergeProgress && (
          <div>
            <Alert
              type="success"
              showIcon
              message="Record pulled out successfully!"
              description={`"${unmergeProgress.newRecordName}" is now a standalone record. Moved ${unmergeProgress.moved?.toLocaleString()} time record(s).`}
              style={{ marginBottom: 12 }}
            />
          </div>
        )}

        {/* Step: Cancelled */}
        {unmergeStep === "cancelled" && (
          <div>
            <Alert
              type="warning"
              showIcon
              message="Unmerge cancelled"
              description="The unmerge process was aborted. All records have been restored to the container."
              style={{ marginBottom: 12 }}
            />
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default DTRDataTab;
