import React, { useEffect, useState } from "react";
import {
  Table,
  Spin,
  Alert,
  Tag,
  Modal,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Tooltip,
  Typography,
} from "antd";
import { InfoCircleOutlined, EyeOutlined, DownloadOutlined, DeleteOutlined, LinkOutlined, CalendarOutlined } from "@ant-design/icons";
import useDemoMode from "../../../../../hooks/useDemoMode";
import dayjs from "dayjs";
import axiosInstance from "../../../../../api/axiosInstance";

// Import PDF generation utilities
import { generateDTRPdf } from "../../../../../../utils/generateDTRpdf.js";
import { openPayslipInNewTab } from "../../../../../../utils/generatePaySlipContract.js";
import { openPayslipInNewTabRegular } from "../../../../../../utils/generatePaySlipRegular.js";


const { Option } = Select;
const { Text } = Typography;

const docColors = {
  Payslip: "blue",
  "Certificate of Employment": "green",
  "Salary Record": "orange",
  Appraisal: "purple",
  DTR: "red", // auto-logged DTR
  Other: "default",
};

/**
 * Transforms a flat array of DTR logs into the nested object structure
 * required by the generateDTRPdf utility.
 * Maps raw states (e.g., 'C/In', 'Out', 'Out Back', 'C/Out') to
 * the expected keys: 'Time In', 'Break Out', 'Break In', 'Time Out'.
 * @param {Array} logs - The flat array of log objects.
 * @param {Object} employee - The employee object.
 * @returns {Object} - The transformed logs.
 */
const transformLogsForDTR = (logs, employee) => {
  const dtrLogs = {};
  const empId = employee.empId;
  dtrLogs[empId] = {};

  const STATE_MAP = {
    "C/In": "Time In",
    "Out": "Break Out",
    "Out Back": "Break In",
    "C/Out": "Time Out",
  };

  logs.forEach((log) => {
    const dateKey = dayjs(log.time).format("YYYY-MM-DD");
    if (!dtrLogs[empId][dateKey]) {
      dtrLogs[empId][dateKey] = {};
    }
    const mappedKey = STATE_MAP[log.state];
    if (!mappedKey) return; // ignore unrecognized states
    // Only set the first occurrence per type for the day; include AM/PM
    if (!dtrLogs[empId][dateKey][mappedKey]) {
      dtrLogs[empId][dateKey][mappedKey] = dayjs(log.time).format("h:mm A");
    }
  });
  return dtrLogs;
};


const OtherDetails = ({ employee }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingDocId, setGeneratingDocId] = useState(null);
  const [form] = Form.useForm();
  const { readOnly: demoDisabled, isPrivileged } = useDemoMode();

  useEffect(() => {
    if (!employee?.empId) return;
    fetchDocs();
  }, [employee?.empId]);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/employee-docs/by-employee/${employee.empId}`
      );
      setDocs(res.data.data || []);
    } catch (err) {
      setError(err.message || "Failed to fetch employee documents");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDoc = async (values) => {
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
      return;
    }
    try {
      const payload = {
        ...values,
        empId: employee.empId,
        dateIssued: values.dateIssued
          ? values.dateIssued.toISOString()
          : undefined,
      };
      const res = await axiosInstance.post("/employee-docs", payload);
      if (res.data.success) {
        message.success("Document added successfully");
        setAddModalVisible(false);
        form.resetFields();
        fetchDocs();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to add document");
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
      return;
    }
    try {
      const res = await axiosInstance.delete(`/employee-docs/${docId}`);
      if (res.data.success) {
        message.success("Document deleted successfully");
        fetchDocs();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to delete document");
    }
  };

  const handleViewDoc = async (record) => {
    setGeneratingDocId(record._id);
    setIsGenerating(true);

    try {
      switch (record.docType) {
        case "DTR": {
          message.loading({ content: "Generating DTR...", key: "pdf" });
          // Fetch available DTR records and find by record reference (name)
          const listRes = await axiosInstance.get('/dtrdatas');
          const list = listRes?.data?.data || [];
          const selectedRecord = list.find((r) => r.DTR_Record_Name === record.reference);

          if (!selectedRecord) {
            throw new Error("DTR record not found.");
          }

          const { start, end } = selectedRecord.DTR_Cut_Off || {};
          if (!start || !end) {
            throw new Error("Invalid DTR cut-off period.");
          }

          // Normalize to Manila date-only to avoid timezone drift (e.g., Aug 31 vs Sep 1)
          const startLocal = dayjs(start).tz("Asia/Manila").format("YYYY-MM-DD");
          const endLocal = dayjs(end).tz("Asia/Manila").format("YYYY-MM-DD");

          const logsRes = await axiosInstance.get('/dtrlogs/work-calendar', {
            params: { employeeId: employee._id, startDate: startLocal, endDate: endLocal }
          });

          const dtrLogs = transformLogsForDTR(logsRes.data.data, employee);

          // Pass sanitized cut-off to the PDF generator
          const sanitizedRecord = {
            ...selectedRecord,
            DTR_Cut_Off: { start: startLocal, end: endLocal },
          };

          await generateDTRPdf({
            employee,
            dtrLogs,
            selectedRecord: sanitizedRecord,
            download: false, // Opens in new tab
          });
          message.success({ content: "DTR generated successfully!", key: "pdf" });
          break;
        }

        case "Payslip": {
          message.loading({ content: "Opening payslip...", key: "pdf" });
          // Prefer embedded payload saved at generation time
          const payslipData = record.payload;
          const payslipNumber = record.docNo || 0;
          const isFullMonthRange = record.isFullMonthRange ?? false;

          if (!payslipData) {
            throw new Error("Payslip details are not available for this record.");
          }

          if (employee.empType === 'Regular') {
            openPayslipInNewTabRegular(payslipData, payslipNumber, isFullMonthRange);
          } else {
            openPayslipInNewTab(payslipData, payslipNumber, isFullMonthRange);
          }
          message.success({ content: "Payslip opened in a new tab!", key: "pdf" });
          break;
        }

        default:
          // Fallback to original behavior for other document types
          setSelectedDoc(record);
          break;
      }
    } catch (err) {
      console.error("Failed to generate document:", err);
      message.error({ content: err.response?.data?.message || "Failed to generate document.", key: "pdf" });
    } finally {
      setIsGenerating(false);
      setGeneratingDocId(null);
    }
  };

  const dtrDocs = docs.filter((d) => d.docType === "DTR");
  const otherDocs = docs.filter((d) => d.docType !== "DTR");

  const formatSize = (s) => {
    if (!s && s !== 0) return "-";
    const kb = s / 1024;
    const mb = kb / 1024;
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(1)} KB`;
  };

  const getDownloadUrl = (r) => {
    if (!r) return null;
    if (r.reference && /^https?:\/\//i.test(r.reference)) return r.reference;
    if (r.storageProvider === 'drive' && r.fileId) return `/api/uploads/${r.fileId}`;
    if (r.reference) return `/api/uploads/${r.reference}`;
    return null;
  };

  const handleOpenFile = (r) => {
    // For DTR/Payslip, keep generator behavior
    if (r.docType === 'DTR' || r.docType === 'Payslip') return handleViewDoc(r);
    const url = getDownloadUrl(r);
    if (url) {
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch (_) {}
    } else {
      setSelectedDoc(r);
    }
  };

  const handleDownloadFile = (r) => {
    const url = getDownloadUrl(r);
    if (!url) return message.info("No file available for this document");
    const a = document.createElement('a');
    a.href = url;
    a.download = r?.originalFilename || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const columns = [
    {
      title: "Type",
      dataIndex: "docType",
      key: "docType",
      width: 140,
      render: (t, r) => (
        <>
          <Tag color={docColors[t] || "default"}>{t}</Tag>
          {t === "DTR" && (
            <Tooltip title="Auto-logged from DTR print/download">
              <InfoCircleOutlined style={{ marginLeft: 4, color: "#fa541c" }} />
            </Tooltip>
          )}
        </>
      ),
    },
    {
      title: "Reference / Period",
      key: "ref-period",
      render: (_, r) => {
        const isLink = r.reference && /^https?:\/\//i.test(r.reference);
        return (
          <div>
            <span>
              {isLink ? (
                <a href={r.reference} target="_blank" rel="noopener noreferrer">
                  <Text ellipsis={{ tooltip: r.reference }} style={{ maxWidth: 420, display: "inline-block" }}>
                    {r.reference}
                  </Text>
                  <LinkOutlined style={{ marginLeft: 6, color: "var(--ant-color-text-tertiary)" }} />
                </a>
              ) : (
                <Text ellipsis={{ tooltip: r.reference }}>{r.reference || "-"}</Text>
              )}
            </span>
            <div>
              <Text type="secondary">
                <CalendarOutlined style={{ marginRight: 6 }} />
                {r.period || "-"}
              </Text>
            </div>
          </div>
        );
      },
    },
    // Filename, Storage, Size columns removed per request
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 140,
      render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "-"),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Tooltip title="View">
            <Button
              size="small"
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => handleOpenFile(record)}
              loading={generatingDocId === record._id}
              disabled={isGenerating}
            />
          </Tooltip>
          <Tooltip title={getDownloadUrl(record) ? "Download" : (isPrivileged ? "Open details (no file)" : "No file available") }>
            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (getDownloadUrl(record)) return handleDownloadFile(record);
                if (isPrivileged) {
                  setSelectedDoc(record);
                }
              }}
              disabled={!getDownloadUrl(record) && !isPrivileged}
            />
          </Tooltip>
          {!demoDisabled && record.docType !== "DTR" && (
            <Popconfirm
              title="Are you sure you want to delete this document?"
              okText="Yes"
              cancelText="No"
              onConfirm={() => handleDeleteDoc(record._id)}
            >
              <Tooltip title="Delete">
                <Button size="small" type="primary" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <Spin size="large" style={{ margin: "20px" }} />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div>
      {!demoDisabled && (
        <Button
          type="primary"
          style={{ marginBottom: 16 }}
          onClick={() => setAddModalVisible(true)}
        >
          Add Document
        </Button>
      )}

      {/* Other Documents */}
      {otherDocs.length > 0 && (
        <>
          <h3>Other Documents</h3>
          <Table
            columns={columns}
            dataSource={otherDocs}
            rowKey={(record) => record._id}
            pagination={{ pageSize: 10 }}
            bordered
            size="small"
          />
        </>
      )}

      {/* Document Modal */}
      <Modal
        title={selectedDoc?.docType}
        open={!!selectedDoc}
        onCancel={() => setSelectedDoc(null)}
        footer={null}
        width={600}
      >
        {selectedDoc && (
          <div style={{ lineHeight: 1.5, fontSize: 14 }}>
            <p>
              <strong>Reference:</strong>{" "}
              {selectedDoc.reference?.startsWith("http") ? (
                <a
                  href={selectedDoc.reference}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {selectedDoc.reference}
                </a>
              ) : (
                selectedDoc.reference
              )}
            </p>
            <p>
              <strong>Description:</strong>{" "}
              {selectedDoc.description || "No description"}
            </p>
            <p>
              <strong>Issued/Period:</strong>{" "}
              {selectedDoc.period ||
                (selectedDoc.dateIssued
                  ? dayjs(selectedDoc.dateIssued).format("MMM D, YYYY")
                  : "-")}
            </p>
            <p>
              <strong>Created:</strong>{" "}
              {dayjs(selectedDoc.createdAt).format("MMM D, YYYY")}
            </p>
          </div>
        )}
      </Modal>

      {/* Add Document Modal */}
      {!demoDisabled && (
      <Modal
        title="Add Document"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => form.submit()}
        okText="Save"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddDoc}
          initialValues={{ docType: "Payslip" }}
        >
          <Form.Item
            name="docType"
            label="Document Type"
            rules={[
              { required: true, message: "Please select a document type" },
            ]}
          >
            <Select>
              <Option value="Payslip">Payslip</Option>
              <Option value="Certificate of Employment">
                Certificate of Employment
              </Option>
              <Option value="Salary Record">Salary Record</Option>
              <Option value="Appraisal">Appraisal</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reference"
            label="Reference (IIS No. or Link)"
            rules={[{ required: true, message: "Reference is required" }]}
          >
            <Input placeholder="R3-2025-0***** or Google Drive/OneDrive link" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          <Form.Item name="period" label="Period (optional)">
            <Input placeholder="e.g. July 2025" />
          </Form.Item>

          <Form.Item name="dateIssued" label="Date Issued (optional)">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
      )}
    </div>
  );
};

export default OtherDetails;