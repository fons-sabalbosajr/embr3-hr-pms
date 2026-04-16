import React, { useEffect, useState, useMemo } from "react";
import useDemoMode from "../../../hooks/useDemoMode";
import useAuth from "../../../hooks/useAuth";
import { swalSuccess, swalError, swalWarning, swalConfirm } from "../../../utils/swalHelper";
import {
  secureSessionGet,
  secureSessionStore,
} from "../../../../utils/secureStorage";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Transfer,
  Checkbox,
  Dropdown,
  Grid,
  Upload,
  Progress,
  Spin,
  Alert,
  Tooltip,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, CalendarOutlined } from "@ant-design/icons";
import axiosInstance from "../../../api/axiosInstance";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import tinycolor from "tinycolor2";
import "./trainings.css";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const { Option } = Select;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

const Trainings = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px
  const isTablet = screens.md && !screens.lg; // 768–991px
  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [filters, setFilters] = useState({
    name: "",
    host: "",
    participant: "",
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [useDateRange, setUseDateRange] = useState(false);

  // Per-participant attendance dates: { empId: ['2026-04-13', '2026-04-14', ...] }
  const [participantDates, setParticipantDates] = useState({});

  // Document scan state
  const [scanUploading, setScanUploading] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanFileList, setScanFileList] = useState([]); // processed files list
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [editableUnmatched, setEditableUnmatched] = useState([]); // [{key, name}]
  const [rematching, setRematching] = useState(false);
  const [scanRawText, setScanRawText] = useState(""); // raw OCR text from all files

  const [form] = Form.useForm();
  const { readOnly, isDemoActive, isDemoUser } = useDemoMode();
  const { user } = useAuth();
  const isDeveloper = Boolean(
    user?.userType === "developer" ||
    user?.canAccessDeveloper ||
    user?.canSeeDev,
  );
  // Track IDs or signatures of trainings created in this session to allow deletion in demo
  const DEMO_SESSION_KEY = "__demo_new_training__";
  const [demoNewSet, setDemoNewSet] = useState(() => {
    try {
      const arr = secureSessionGet(DEMO_SESSION_KEY) || [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  });
  const persistDemoNew = (nextSet) => {
    try {
      secureSessionStore(DEMO_SESSION_KEY, Array.from(nextSet));
    } catch (_) {}
  };
  const markSessionNew = (idOrSig) => {
    if (!idOrSig) return;
    setDemoNewSet((prev) => {
      const next = new Set(prev);
      next.add(String(idOrSig));
      persistDemoNew(next);
      return next;
    });
  };
  const makeSignature = (payloadOrRecord) => {
    if (!payloadOrRecord) return "";
    const t = payloadOrRecord;
    const dates = Array.isArray(t.trainingDate)
      ? t.trainingDate.join("|")
      : String(t.trainingDate || "");
    return [
      t.name || "",
      t.host || "",
      t.venue || "",
      dates,
      t.iisTransaction || "",
    ].join("::");
  };
  const isRecordSessionNew = (record) => {
    if (!isDemoActive || !record) return false;
    if (record._id && demoNewSet.has(String(record._id))) return true;
    const sig = makeSignature(record);
    return sig && demoNewSet.has(sig);
  };

  useEffect(() => {
    fetchEmployees();
    fetchTrainings();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get("/employees");
      setEmployees(res.data);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  };

  const fetchTrainings = async () => {
    try {
      const res = await axiosInstance.get("/trainings");
      setTrainings(res.data);
    } catch (err) {
      console.error("Failed to fetch trainings", err);
    }
  };

  const openModal = (training = null) => {
    setEditingTraining(training);
    setIsModalOpen(true);
    setScanResults(null);

    if (training) {
      setSelectedParticipants(training.participants?.map((p) => p.empId) || []);

      const isRange = training.trainingDate?.length > 1;
      setUseDateRange(isRange);

      // Load per-participant attendance dates
      const dates = {};
      (training.participants || []).forEach((p) => {
        if (p.attendanceDates?.length) {
          dates[p.empId] = p.attendanceDates.map((d) => dayjs(d).format("YYYY-MM-DD"));
        }
      });
      setParticipantDates(dates);

      // Convert ISO strings to dayjs objects for AntD pickers
      const trainingDateValue = training.trainingDate?.map((d) => dayjs(d));

      form.setFieldsValue({
        name: training.name || "",
        host: training.host || "",
        venue: training.venue || "",
        iisTransaction: training.iisTransaction || "",
        trainingDate: isRange
          ? trainingDateValue // Array of dayjs for RangePicker
          : trainingDateValue?.[0], // Single dayjs for DatePicker
      });
    } else {
      setSelectedParticipants([]);
      setParticipantDates({});
      form.resetFields();
      setUseDateRange(false); // default single picker
      form.setFieldsValue({
        trainingDate: undefined, // empty by default
      });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTraining(null);
    setParticipantDates({});
    setScanResults(null);
    setScanModalVisible(false);
    setScanFileList([]);
    setScanUploading(false);
    form.resetFields();
  };

  // --- handleSubmit simplified ---
  const handleSubmit = async (values) => {
    try {
      // If user did not pick a date, use defaults
      let dateField = values.trainingDate;

      if (!dateField) {
        if (useDateRange) {
          // default to this week
          dateField = [dayjs().startOf("week"), dayjs().endOf("week")];
        } else {
          // default to today
          dateField = dayjs();
        }
      }

      // Convert to ISO strings for backend
      let trainingDatePayload = null;
      if (useDateRange) {
        if (Array.isArray(dateField)) {
          trainingDatePayload = [
            dateField[0].toISOString(),
            dateField[1].toISOString(),
          ];
        } else {
          // just in case
          trainingDatePayload = [dateField.toISOString()];
        }
      } else {
        trainingDatePayload = [dateField.toISOString()];
      }

      // Participants payload
      const participantsPayload = selectedParticipants.map((empId) => {
        const emp = employees.find((e) => e.empId === empId);
        const empData = emp ? { ...emp } : { empId };
        // Attach attendance dates if any
        if (participantDates[empId]?.length) {
          empData.attendanceDates = participantDates[empId].map((d) => dayjs(d).toISOString());
        } else {
          empData.attendanceDates = [];
        }
        return empData;
      });

      const payload = {
        ...values,
        trainingDate: trainingDatePayload,
        participants: participantsPayload,
        iisTransaction: values.iisTransaction,
      };

      if (editingTraining) {
        await axiosInstance.put(`/trainings/${editingTraining._id}`, payload);
        swalSuccess("Training updated successfully ✅");
      } else {
        const res = await axiosInstance.post("/trainings", payload);
        const createdId =
          res?.data?.data?._id || res?.data?._id || res?.data?.id;
        if (createdId) {
          markSessionNew(createdId);
        } else {
          // Fallback: mark via signature if id is not returned
          markSessionNew(makeSignature(payload));
        }
        swalSuccess("Training added successfully ✅");
      }

      fetchTrainings();
      closeModal();
      setSelectedParticipants([]);
    } catch (err) {
      console.error("Failed to save training", err);
      swalError("Failed to save training ❌");
    }
  };

  const handleDelete = async (id, record) => {
    // In demo mode, only allow delete for session-new items
    if (isDemoActive && !isRecordSessionNew(record)) {
      swalWarning("Delete disabled in demo for existing records");
      return;
    }
    try {
      await axiosInstance.delete(`/trainings/${id}`);
      setTrainings((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      console.error("Failed to delete training", err);
    }
  };

  // ── Document Scan: Upload PDF/Image(s) to extract attendee names ──
  const openScanModal = () => {
    setScanResults(null);
    setScanFileList([]);
    setScanProgress({ current: 0, total: 0 });
    setScanUploading(false);
    setScanModalVisible(true);
    setEditableUnmatched([]);
    setRematching(false);
    setScanRawText("");
  };

  const handleScanFiles = async (files) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validFiles = [];
    for (const file of files) {
      if (!allowed.includes(file.type)) {
        swalError(`"${file.name}" is not a supported file type. Use PDF, JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        swalError(`"${file.name}" is too large (max 10MB).`);
        continue;
      }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    setScanUploading(true);
    setScanProgress({ current: 0, total: validFiles.length });

    // Accumulate results from all files
    let allMatched = [];
    let allExtracted = [];
    let allUnmatched = [];
    let allRawText = [];
    const processedFiles = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setScanProgress({ current: i + 1, total: validFiles.length });
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await axiosInstance.post("/trainings/scan-attendance", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        });
        const { matchedEmployees = [], extractedNames = [], unmatchedNames = [], rawText = "" } = res.data;
        allMatched = [...allMatched, ...matchedEmployees];
        allExtracted = [...allExtracted, ...extractedNames];
        allUnmatched = [...allUnmatched, ...unmatchedNames];
        if (rawText) allRawText.push(rawText);
        processedFiles.push({ name: file.name, status: "done", matched: matchedEmployees.length, unmatched: unmatchedNames.length });
      } catch (err) {
        console.error(`Scan failed for ${file.name}:`, err);
        processedFiles.push({ name: file.name, status: "error", error: err.response?.data?.message || "Failed" });
      }
    }

    // Deduplicate matched employees by empId
    const seenIds = new Set();
    const dedupMatched = [];
    for (const m of allMatched) {
      if (!seenIds.has(m.empId)) {
        seenIds.add(m.empId);
        dedupMatched.push(m);
      }
    }

    const uniqueUnmatched = [...new Set(allUnmatched)];
    setScanResults({ matchedEmployees: dedupMatched, extractedNames: allExtracted, unmatchedNames: uniqueUnmatched });
    setEditableUnmatched(uniqueUnmatched.map((name, i) => ({ key: i, name })));
    setScanRawText(allRawText.join("\n\n---\n\n"));
    setScanFileList(processedFiles);
    setScanUploading(false);
  };

  const applyScanResults = () => {
    if (scanResults?.matchedEmployees?.length) {
      const newIds = scanResults.matchedEmployees.map((m) => m.empId);
      setSelectedParticipants((prev) => {
        const combined = new Set([...prev, ...newIds]);
        return Array.from(combined);
      });
      swalSuccess(`Added ${scanResults.matchedEmployees.length} employee(s) from scanned documents`);
    }
    setScanModalVisible(false);
  };

  const handleRematchNames = async () => {
    const names = editableUnmatched.map((r) => r.name.trim()).filter(Boolean);
    if (!names.length) {
      swalWarning("No names to re-match");
      return;
    }
    setRematching(true);
    try {
      const res = await axiosInstance.post("/trainings/rematch-names", { names }, { timeout: 30000 });
      const { matchedEmployees = [], unmatchedNames = [] } = res.data;
      if (matchedEmployees.length) {
        // Merge newly matched into existing results (dedup by empId)
        setScanResults((prev) => {
          const existingIds = new Set((prev?.matchedEmployees || []).map((m) => m.empId));
          const newMatches = matchedEmployees.filter((m) => !existingIds.has(m.empId));
          return {
            ...prev,
            matchedEmployees: [...(prev?.matchedEmployees || []), ...newMatches],
            unmatchedNames: unmatchedNames,
          };
        });
        swalSuccess(`Re-matched ${matchedEmployees.length} employee(s)`);
      } else {
        swalWarning("No new matches found. Try editing the names further.");
      }
      // Update editable list with remaining unmatched
      setEditableUnmatched(unmatchedNames.map((name, i) => ({ key: i, name })));
    } catch (err) {
      console.error("Rematch failed:", err);
      swalError(err.response?.data?.message || "Failed to re-match names");
    }
    setRematching(false);
  };

  // Filter the table data
  const filteredTrainings = trainings.filter((t) => {
    const nameMatch = t.name.toLowerCase().includes(filters.name.toLowerCase());
    const hostMatch = t.host.toLowerCase().includes(filters.host.toLowerCase());
    const participantMatch = filters.participant
      ? t.participants?.some((p) => p.empId === filters.participant)
      : true;
    return nameMatch && hostMatch && participantMatch;
  });

  const columns = [
    {
      title: () => <span style={{ fontSize: "12px" }}>Training Name</span>,
      dataIndex: "name",
      key: "name",
      align: "center",
      width: isMobile ? 160 : 250,
      render: (text) => (
        <div style={{ textAlign: "left", fontSize: "12px" }}>{text}</div>
      ),
    },
    // On mobile, merge Host and Venue into Training Name area via hidden columns
    ...(!isMobile
      ? [
          {
            title: () => (
              <span style={{ fontSize: "12px" }}>Training Host</span>
            ),
            dataIndex: "host",
            key: "host",
            align: "center",
            width: isTablet ? 100 : 120,
            render: (text) => (
              <div style={{ textAlign: "left", fontSize: "12px" }}>{text}</div>
            ),
          },
          {
            title: () => <span style={{ fontSize: "12px" }}>Venue</span>,
            dataIndex: "venue",
            key: "venue",
            align: "center",
            width: isTablet ? 100 : 120,
            render: (text) => (
              <div style={{ textAlign: "left", fontSize: "12px" }}>{text}</div>
            ),
          },
        ]
      : []),
    {
      title: () => (
        <span style={{ fontSize: "12px" }}>
          {isMobile ? "Date" : "Training Date"}
        </span>
      ),
      dataIndex: "trainingDate",
      key: "trainingDate",
      align: "center",
      width: isMobile ? 90 : 100,
      render: (dates) =>
        dates ? (
          <div style={{ textAlign: "left", fontSize: "12px" }}>
            {dayjs(dates[0]).format("MM/DD/YYYY")} -{" "}
            {dayjs(dates[1]).format("MM/DD/YYYY")}
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: () => <span style={{ fontSize: "12px" }}>Participants</span>,
      dataIndex: "participants",
      key: "participants",
      align: "center",
      render: (participants) => {
        if (!participants) return null;

        // Group participants by division
        const grouped = participants.reduce((acc, emp) => {
          if (!acc[emp.division]) acc[emp.division] = [];
          acc[emp.division].push(emp);
          return acc;
        }, {});

        return (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {Object.entries(grouped).map(([division, emps]) => {
              const divisionColor = divisionColors[division] || "#555";

              // Darken and add transparency for dropdown background
              const dropdownBg = tinycolor(divisionColor)
                .darken(15)
                .setAlpha(0.95)
                .toRgbString();

              return (
                <Dropdown
                  key={division}
                  menu={{
                    items: emps.map((emp) => ({
                      key: emp.empId,
                      label: (
                        <div
                          style={{
                            padding: "2px 8px",
                            color: emp.resigned ? "#ddd" : "#fff",
                            fontSize: "12px",
                            textDecoration: emp.resigned
                              ? "line-through"
                              : undefined,
                            opacity: emp.resigned ? 0.7 : 1,
                          }}
                          title={emp.resigned ? "Resigned" : undefined}
                        >
                          {emp.name}{" "}
                          {emp.sectionOrUnit ? `- ${emp.sectionOrUnit}` : ""}
                          {emp.resigned ? " (Resigned)" : ""}
                        </div>
                      ),
                    })),
                    style: {
                      backgroundColor: dropdownBg,
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: "auto",
                    },
                  }}
                  trigger={["click"]}
                >
                  <Tag
                    style={{
                      backgroundColor: divisionColor,
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    {division} ({emps.length})
                  </Tag>
                </Dropdown>
              );
            })}
          </div>
        );
      },
    },
    ...(!isMobile
      ? [
          {
            title: () => (
              <span style={{ fontSize: "12px" }}>
                IIS Transaction No./RSO No.
              </span>
            ),
            dataIndex: "iisTransaction",
            key: "iisTransaction",
            align: "center",
            width: isTablet ? 100 : 120,
            render: (text) => (
              <div style={{ textAlign: "left", fontSize: "13px" }}>{text}</div>
            ),
          },
        ]
      : []),
    {
      title: () => <span style={{ fontSize: "12px" }}>Actions</span>,
      key: "actions",
      align: "center",
      render: (_, record) => {
        const demoDeleteDisabled =
          isDemoActive && !isRecordSessionNew(record) && !isDeveloper;
        return (
          <div style={{ textAlign: "left" }}>
            <Space>
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => openModal(record)}
                type="primary"
                disabled={readOnly && isDemoActive && isDemoUser}
              />
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                type="primary"
                disabled={demoDeleteDisabled}
                onClick={async () => {
                  if (demoDeleteDisabled) return;
                  const result = await swalConfirm({
                    title: "Delete this training?",
                    text: demoDeleteDisabled
                      ? "Deletion is disabled in demo for existing records"
                      : "This action cannot be undone.",
                    confirmText: "Delete",
                    dangerMode: true,
                  });
                  if (result.isConfirmed) {
                    handleDelete(record._id, record);
                  }
                }}
              />
            </Space>
          </div>
        );
      },
    },
  ];

  const divisionColors = {
    "Clearance and Permitting Division": "#1f9cca", // blue
    "Finance and Administrative Division": "#283539", // green
    "Environmental Monitoring and Enforcement Division": "#009d8c", // orange
    "Office of the Regional Director": "#cb330e", // pink/red
    "Specialized Team": "#fd8004",
  };

  const divisionShortcuts = {
    CPD: "Clearance and Permitting Division",
    FAD: "Finance and Administrative Division",
    EMED: "Environmental Monitoring and Enforcement Division",
    ORD: "Office of the Regional Director",
    "Specialized Team": "Specialized Team",
  };

  return (
    <div>
      <h2 className="trainings-title">Office Trainings</h2>
      {/* Filters */}
      <div
        className="trainings-filters-container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {/* Filters */}
        <Space wrap style={{ width: isMobile ? "100%" : "auto" }}>
          <Input
            placeholder="Filter by Training Name"
            value={filters.name}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            allowClear
            style={{ width: isMobile ? "100%" : 200 }}
          />
          <Input
            placeholder="Filter by Host"
            value={filters.host}
            onChange={(e) => setFilters({ ...filters, host: e.target.value })}
            allowClear
            style={{ width: isMobile ? "100%" : 200 }}
          />
          <Select
            placeholder="Filter by Participant"
            allowClear
            style={{ width: isMobile ? "100%" : 250 }}
            value={filters.participant}
            onChange={(value) => setFilters({ ...filters, participant: value })}
          >
            {employees.map((emp) => (
              <Option key={emp.empId} value={emp.empId}>
                {emp.name} ({emp.empNo})
              </Option>
            ))}
          </Select>
        </Space>

        {/* Add Training Button */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
          disabled={readOnly && isDemoActive && isDemoUser}
        >
          Add Training
        </Button>
      </div>

      <div className="trainings-table">
        <Table
          columns={columns}
          dataSource={filteredTrainings}
          rowKey="_id"
          size="small"
          scroll={{ x: isMobile ? 500 : isTablet ? 800 : 1000 }}
        />
      </div>
      {isModalOpen && (
        <Modal
          open={true}
          onCancel={closeModal}
          footer={null}
          destroyOnHidden
          className="trainings-modal"
          width={700}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Training Name"
              name="name"
              rules={[
                { required: true, message: "Please enter training name" },
              ]}
            >
              <Input.TextArea
                rows={2}
                disabled={readOnly && isDemoActive && isDemoUser}
              />
            </Form.Item>

            <Space.Compact style={{ width: "100%" }}>
              <Form.Item
                label="Training Host"
                name="host"
                rules={[{ required: true, message: "Please enter host" }]}
                style={{ flex: 1 }}
              >
                <Input disabled={readOnly && isDemoActive && isDemoUser} />
              </Form.Item>

              <Form.Item
                label="Training Venue"
                name="venue"
                rules={[{ required: true, message: "Please enter venue" }]}
                style={{ flex: 1, marginLeft: 8 }}
              >
                <Input disabled={readOnly && isDemoActive && isDemoUser} />
              </Form.Item>
            </Space.Compact>

            <Form.Item
              label="Training Date"
              name="trainingDate"
              rules={[{ required: true, message: "Please select a date" }]}
            >
              <Space>
                {useDateRange ? (
                  <RangePicker
                    value={(() => {
                      const val = form.getFieldValue("trainingDate");
                      if (!val || !Array.isArray(val)) return undefined;
                      return [dayjs(val[0]), dayjs(val[1])];
                    })()}
                    onChange={(dates) =>
                      form.setFieldsValue({ trainingDate: dates })
                    }
                    size="small"
                    format="MM/DD/YYYY"
                    allowClear
                    disabled={readOnly && isDemoActive && isDemoUser}
                  />
                ) : (
                  <DatePicker
                    value={(() => {
                      const val = form.getFieldValue("trainingDate");
                      if (!val || Array.isArray(val)) return undefined;
                      return dayjs(val);
                    })()}
                    onChange={(date) =>
                      form.setFieldsValue({ trainingDate: date })
                    }
                    size="small"
                    format="MM/DD/YYYY"
                    allowClear
                    disabled={readOnly && isDemoActive && isDemoUser}
                  />
                )}

                <Checkbox
                  checked={useDateRange}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setUseDateRange(isChecked);

                    // Clear picker value when switching to avoid invalid dates
                    form.setFieldsValue({ trainingDate: undefined });
                  }}
                  disabled={readOnly && isDemoActive && isDemoUser}
                >
                  Use Date Range
                </Checkbox>
              </Space>
            </Form.Item>

            {/* Scan Document to Auto-populate Participants */}
            <div style={{ marginBottom: 12 }}>
              <Tooltip title="Upload training attendance sheets (PDF or images) to automatically detect and add participants">
                <Button
                  icon={<UploadOutlined />}
                  size="small"
                  type="dashed"
                  onClick={openScanModal}
                  disabled={readOnly && isDemoActive && isDemoUser}
                >
                  Scan Attendance Sheet
                </Button>
              </Tooltip>
            </div>

            {/* Participants Transfer */}
            <Form.Item
              label="Participants"
              name="participants"
              rules={[
                {
                  validator: (_, value) =>
                    selectedParticipants && selectedParticipants.length
                      ? Promise.resolve()
                      : Promise.reject(new Error("Select participants")),
                },
              ]}
            >
              <Transfer
                className="compact-transfer"
                dataSource={employees
                  .map((emp) => ({
                    key: emp.empId,
                    title: emp.name,
                    description: emp.empNo,
                    division: emp.division,
                    section: emp.sectionOrUnit,
                  }))
                  .sort((a, b) => a.title.localeCompare(b.title))}
                showSearch
                searchPlaceholder="Search name, division, section, or acronym..."
                listStyle={{ width: 250, height: 300 }}
                targetKeys={selectedParticipants}
                onChange={setSelectedParticipants}
                render={(item) => (
                  <span
                    style={{ color: divisionColors[item.division] || "#000" }}
                  >
                    {item.title}
                  </span>
                )}
                filterOption={(inputValue, item) => {
                  const lowerInput = inputValue.toLowerCase();
                  const nameMatch = item.title
                    .toLowerCase()
                    .includes(lowerInput);
                  const divisionMatch = item.division
                    .toLowerCase()
                    .includes(lowerInput);
                  const sectionMatch = (item.section || "")
                    .toLowerCase()
                    .includes(lowerInput);
                  const shortcutMatch = Object.entries(divisionShortcuts).some(
                    ([shortcut, full]) =>
                      shortcut.toLowerCase() === lowerInput &&
                      item.division === full,
                  );
                  return (
                    nameMatch || divisionMatch || sectionMatch || shortcutMatch
                  );
                }}
                disabled={readOnly && isDemoActive && isDemoUser}
                renderList={(listProps) => {
                  const { direction, filteredItems, onItemSelect } = listProps;

                  if (direction === "left") {
                    const grouped = filteredItems.reduce((acc, item) => {
                      if (!acc[item.division]) acc[item.division] = [];
                      acc[item.division].push(item);
                      return acc;
                    }, {});

                    return (
                      <div
                        style={{
                          width: 250,
                          minHeight: 300,
                          maxHeight: 300,
                          overflowY: "auto",
                          border: "1px solid #d9d9d9",
                          borderRadius: 4,
                          padding: "4px",
                        }}
                      >
                        {Object.entries(grouped).map(([division, items]) => (
                          <div key={division} style={{ marginBottom: 8 }}>
                            <div
                              style={{ fontWeight: "bold", marginBottom: 4 }}
                            >
                              {division}
                            </div>
                            {items.map((item) => (
                              <div
                                key={item.key}
                                onClick={() =>
                                  onItemSelect(
                                    item.key,
                                    !selectedParticipants.includes(item.key),
                                  )
                                }
                                style={{
                                  padding: "2px 4px",
                                  cursor: "pointer",
                                  background: selectedParticipants.includes(
                                    item.key,
                                  )
                                    ? "#e6f7ff"
                                    : undefined,
                                  borderRadius: 2,
                                  marginBottom: 2,
                                }}
                              >
                                {item.title}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Right side: selected participants tags
                  return (
                    <div
                      style={{
                        width: 250,
                        minHeight: 300,
                        maxHeight: 300,
                        overflowY: "auto",
                        padding: "4px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        border: "1px solid #d9d9d9",
                        borderRadius: 4,
                        background: "#fff",
                      }}
                    >
                      {filteredItems.map((item) => (
                        <Tag
                          key={item.key}
                          closable
                          onClose={(e) => {
                            e.preventDefault();
                            setSelectedParticipants((prev) =>
                              prev.filter((k) => k !== item.key),
                            );
                          }}
                          style={{
                            fontSize: "11px",
                            color: divisionColors[item.division],
                          }}
                        >
                          {item.title}
                        </Tag>
                      ))}
                    </div>
                  );
                }}
                locale={{
                  itemUnit: "personnel",
                  itemsUnit: "personnel",
                  searchPlaceholder: "Search personnel...",
                }}
              />
            </Form.Item>

            {/* ── Per-Participant Attendance Dates ── */}
            {useDateRange && selectedParticipants.length > 0 && (() => {
              const dateVal = form.getFieldValue("trainingDate");
              if (!dateVal || !Array.isArray(dateVal) || dateVal.length < 2) return null;
              const start = dayjs(dateVal[0]);
              const end = dayjs(dateVal[1]);
              if (!start.isValid() || !end.isValid()) return null;
              const days = [];
              let d = start.clone();
              while (d.isSameOrBefore(end, "day")) {
                days.push(d.format("YYYY-MM-DD"));
                d = d.add(1, "day");
              }
              if (days.length < 2) return null;

              const toggleDate = (empId, dateStr) => {
                setParticipantDates((prev) => {
                  const current = prev[empId] || [...days]; // default: all days
                  const has = current.includes(dateStr);
                  return { ...prev, [empId]: has ? current.filter((d) => d !== dateStr) : [...current, dateStr].sort() };
                });
              };

              const toggleAll = (empId, checked) => {
                setParticipantDates((prev) => ({ ...prev, [empId]: checked ? [...days] : [] }));
              };

              const bulkSetDates = (dateStr, checked) => {
                setParticipantDates((prev) => {
                  const next = { ...prev };
                  selectedParticipants.forEach((empId) => {
                    const current = next[empId] || [...days];
                    if (checked && !current.includes(dateStr)) {
                      next[empId] = [...current, dateStr].sort();
                    } else if (!checked) {
                      next[empId] = current.filter((d) => d !== dateStr);
                    }
                  });
                  return next;
                });
              };

              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CalendarOutlined style={{ color: "#1890ff" }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Attendance Dates per Participant</span>
                    <span style={{ fontSize: 11, color: "#999" }}>(Uncheck dates if participant did not attend all days)</span>
                  </div>
                  <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #f0f0f0", borderRadius: 6, padding: 8 }}>
                    {/* Column header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
                      <div style={{ flex: 1, minWidth: 140, fontSize: 11, fontWeight: 600, color: "#888" }}>Employee</div>
                      {days.map((day) => (
                        <Tooltip key={day} title={`Toggle ${dayjs(day).format("MMM D")} for all`}>
                          <div style={{ width: 54, textAlign: "center", cursor: "pointer" }} onClick={() => {
                            const allHave = selectedParticipants.every((empId) => (participantDates[empId] || days).includes(day));
                            bulkSetDates(day, !allHave);
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#555" }}>{dayjs(day).format("MMM D")}</div>
                            <div style={{ fontSize: 9, color: "#aaa" }}>{dayjs(day).format("ddd")}</div>
                          </div>
                        </Tooltip>
                      ))}
                      <div style={{ width: 40, textAlign: "center", fontSize: 10, fontWeight: 600, color: "#888" }}>All</div>
                    </div>
                    {/* Participant rows */}
                    {selectedParticipants.map((empId) => {
                      const emp = employees.find((e) => e.empId === empId);
                      const empDates = participantDates[empId] || days; // default: all days
                      const allChecked = days.every((d) => empDates.includes(d));
                      return (
                        <div key={empId} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid #fafafa" }}>
                          <div style={{ flex: 1, minWidth: 140, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <Tooltip title={emp?.name || empId}>
                              {emp?.name || empId}
                            </Tooltip>
                          </div>
                          {days.map((day) => (
                            <div key={day} style={{ width: 54, textAlign: "center" }}>
                              <Checkbox
                                checked={empDates.includes(day)}
                                onChange={() => toggleDate(empId, day)}
                                disabled={readOnly && isDemoActive && isDemoUser}
                              />
                            </div>
                          ))}
                          <div style={{ width: 40, textAlign: "center" }}>
                            <Checkbox
                              checked={allChecked}
                              onChange={(e) => toggleAll(empId, e.target.checked)}
                              disabled={readOnly && isDemoActive && isDemoUser}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* --- IIS Transaction Field simplified --- */}
            <Form.Item
              label="Special Order No. / IIS Transaction No."
              name="iisTransaction"
              rules={[
                {
                  required: true,
                  message:
                    "Please enter Special Order No. or IIS Transaction No.",
                },
              ]}
            >
              <Input
                placeholder="Enter Special Order No. or IIS Transaction No."
                disabled={readOnly && isDemoActive && isDemoUser}
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ display: "flex", justifyContent: "end" }}>
                <Button onClick={closeModal}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={readOnly && isDemoActive && isDemoUser}
                >
                  {editingTraining ? "Update" : "Add"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* Scan Attendance Sheet — Preview Modal */}
      <Modal
        title={
          <Space size={8}>
            <UploadOutlined />
            <span style={{ fontWeight: 600 }}>Scan Attendance Sheet</span>
          </Space>
        }
        open={scanModalVisible}
        onCancel={() => { if (!scanUploading) setScanModalVisible(false); }}
        maskClosable={!scanUploading}
        closable={!scanUploading}
        width={640}
        footer={
          scanResults ? (
            <Space>
              <Button onClick={() => setScanModalVisible(false)}>Cancel</Button>
              <Button
                type="primary"
                disabled={!scanResults.matchedEmployees?.length}
                onClick={applyScanResults}
              >
                Add {scanResults.matchedEmployees?.length || 0} Matched Employee(s)
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setScanModalVisible(false)}>Close</Button>
          )
        }
        destroyOnClose
      >
        {/* Upload area */}
        {!scanResults && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ marginBottom: 8, color: "#555" }}>
              Upload one or more attendance sheets (PDF or images). Each file will be scanned for names and matched against the employee database.
            </p>
            <Upload.Dragger
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              multiple
              showUploadList={false}
              beforeUpload={(file, fileList) => {
                // Only process once for the full batch
                if (file === fileList[0]) {
                  handleScanFiles(fileList);
                }
                return false;
              }}
              disabled={scanUploading}
              style={{ padding: "16px 0" }}
            >
              <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
                <UploadOutlined style={{ fontSize: 32, color: "#1890ff" }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 13 }}>
                Click or drag files here to upload
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 11, color: "#999" }}>
                Supports PDF, JPEG, PNG, WebP — Max 10MB per file
              </p>
            </Upload.Dragger>
          </div>
        )}

        {/* Scanning progress */}
        {scanUploading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Spin size="small" />
              <span style={{ fontSize: 13 }}>Scanning file {scanProgress.current} of {scanProgress.total}...</span>
            </div>
            <Progress
              percent={scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0}
              size="small"
              status="active"
            />
          </div>
        )}

        {/* File processing summary */}
        {scanFileList.length > 0 && !scanUploading && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 500, fontSize: 13, marginBottom: 4, display: "block" }}>Files Processed:</span>
            {scanFileList.map((f, idx) => (
              <Tag
                key={idx}
                color={f.status === "done" ? "green" : "red"}
                style={{ marginBottom: 4 }}
              >
                {f.name} {f.status === "done" ? `(${f.matched} matched, ${f.unmatched} unmatched)` : `(${f.error})`}
              </Tag>
            ))}
          </div>
        )}

        {/* Results preview tables */}
        {scanResults && !scanUploading && (
          <div>
            {/* Matched Employees Table */}
            {scanResults.matchedEmployees?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`${scanResults.matchedEmployees.length} employee(s) matched`}
                />
                <Table
                  size="small"
                  pagination={false}
                  scroll={{ y: 200 }}
                  dataSource={scanResults.matchedEmployees.map((m, i) => ({ ...m, key: i }))}
                  columns={[
                    { title: "Employee Name", dataIndex: "name", key: "name", width: 180 },
                    { title: "Division", dataIndex: "division", key: "division", width: 120, ellipsis: true },
                    { title: "Matched From", dataIndex: "matchedFrom", key: "matchedFrom", width: 160, render: (v) => <span style={{ color: "#888", fontSize: 11 }}>{v}</span> },
                    { title: "Confidence", dataIndex: "confidence", key: "confidence", width: 80, render: (v) => <Tag color={v >= 80 ? "green" : v >= 60 ? "orange" : "red"}>{v}%</Tag> },
                  ]}
                />
              </div>
            )}

            {/* Unmatched Names — Editable Table */}
            {editableUnmatched.length > 0 && (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`${editableUnmatched.length} name(s) could not be matched — edit names below then re-match`}
                />
                <Table
                  size="small"
                  pagination={false}
                  scroll={{ y: 160 }}
                  dataSource={editableUnmatched}
                  rowKey="key"
                  columns={[
                    {
                      title: "#",
                      width: 40,
                      render: (_, __, idx) => <span style={{ color: "#999", fontSize: 11 }}>{idx + 1}</span>,
                    },
                    {
                      title: "Extracted Name",
                      dataIndex: "name",
                      key: "name",
                      render: (val, record) => (
                        <Input
                          size="small"
                          value={val}
                          onChange={(e) => {
                            setEditableUnmatched((prev) =>
                              prev.map((r) => (r.key === record.key ? { ...r, name: e.target.value } : r))
                            );
                          }}
                          style={{ fontSize: 12 }}
                        />
                      ),
                    },
                    {
                      title: "",
                      width: 40,
                      render: (_, record) => (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => setEditableUnmatched((prev) => prev.filter((r) => r.key !== record.key))}
                        />
                      ),
                    },
                  ]}
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <Button
                    size="small"
                    onClick={() => {
                      const nextKey = editableUnmatched.length ? Math.max(...editableUnmatched.map((r) => r.key)) + 1 : 0;
                      setEditableUnmatched((prev) => [...prev, { key: nextKey, name: "" }]);
                    }}
                  >
                    + Add Row
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    loading={rematching}
                    onClick={handleRematchNames}
                  >
                    Re-match Names
                  </Button>
                </div>
              </div>
            )}

            {/* Raw OCR Text (collapsible) */}
            {scanRawText && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 12, color: "#888", cursor: "pointer" }}>Show Raw OCR Text</summary>
                <Input.TextArea
                  value={scanRawText}
                  readOnly
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  style={{ marginTop: 4, fontSize: 11, fontFamily: "monospace", background: "#fafafa" }}
                />
              </details>
            )}

            {/* No matches at all */}
            {!scanResults.matchedEmployees?.length && !editableUnmatched.length && (
              <Alert type="info" showIcon message="No text could be extracted from the uploaded files." />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Trainings;
