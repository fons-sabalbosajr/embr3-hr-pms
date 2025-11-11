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
} from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import useDemoMode from "../../../../../hooks/useDemoMode";
import dayjs from "dayjs";
import axiosInstance from "../../../../../api/axiosInstance";

// Import PDF generation utilities
import { generateDTRPdf } from "../../../../../../utils/generateDTRpdf.js";
import { openPayslipInNewTab } from "../../../../../../utils/generatePaySlipContract.js";
import { openPayslipInNewTabRegular } from "../../../../../../utils/generatePaySlipRegular.js";


const { Option } = Select;

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
 * @param {Array} logs - The flat array of log objects.
 * @param {Object} employee - The employee object.
 * @returns {Object} - The transformed logs.
 */
const transformLogsForDTR = (logs, employee) => {
  const dtrLogs = {};
  const empId = employee.empId;
  dtrLogs[empId] = {};

  logs.forEach((log) => {
    const dateKey = dayjs(log.time).format("YYYY-MM-DD");
    if (!dtrLogs[empId][dateKey]) {
      dtrLogs[empId][dateKey] = {};
    }
    // Use human-readable state from getWorkCalendarLogs and format time
    // Only set the first log of a given type for the day
    if (!dtrLogs[empId][dateKey][log.state]) {
  dtrLogs[empId][dateKey][log.state] = dayjs(log.time).format("h:mm");
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
  const { isDemoActive } = useDemoMode();
  const demoDisabled = isDemoActive;

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
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
      return;
    }
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

          const logsRes = await axiosInstance.get('/dtrlogs/work-calendar', {
            params: { employeeId: employee._id, startDate: start, endDate: end }
          });

          const dtrLogs = transformLogsForDTR(logsRes.data.data, employee);

          await generateDTRPdf({
            employee,
            dtrLogs,
            selectedRecord,
            download: false, // Opens in new tab
          });
          message.success({ content: "DTR generated successfully!", key: "pdf" });
          break;
        }

        case "Payslip": {
          message.loading({ content: "Generating Payslip...", key: "pdf" });
          // NOTE: Assumes an endpoint exists to fetch all necessary payslip data
          // using the reference ID stored in the employee document.
          const payslipRes = await axiosInstance.get(`/payslips/by-reference/${record.reference}`);
          const { payslipData, payslipNumber, isFullMonthRange } = payslipRes.data;

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

  const columns = [
    {
      title: "Document Info",
      key: "info",
      render: (_, record) => (
        <div style={{ lineHeight: 1.5, display: "flex", alignItems: "center" }}>
          <div>
            <strong>Type:</strong>{" "}
            <Tag color={docColors[record.docType] || "default"}>
              {record.docType}
            </Tag>
            {record.docType === "DTR" && (
              <Tooltip title="Auto-logged from DTR print/download">
                <InfoCircleOutlined
                  style={{ marginLeft: 4, color: "#fa541c" }}
                />
              </Tooltip>
            )}
          </div>
          <div>
            <strong>Reference:</strong>{" "}
            {record.reference?.startsWith("http") ? (
              <a
                href={record.reference}
                target="_blank"
                rel="noopener noreferrer"
              >
                {record.reference}
              </a>
            ) : (
              record.reference
            )}
          </div>
          <div>
            <strong>Issued/Period:</strong>{" "}
            {record.period ||
              (record.dateIssued
                ? dayjs(record.dateIssued).format("MMM D, YYYY")
                : "-")}
          </div>
          <div>
            <strong>Created:</strong>{" "}
            {dayjs(record.createdAt).format("MMM D, YYYY")}
          </div>
        </div>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: "25%",
      render: (_, record) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() => handleViewDoc(record)}
            loading={generatingDocId === record._id}
            disabled={isGenerating || demoDisabled}
          >
            View
          </Button>
          {record.docType !== "DTR" && (
            <Popconfirm
              title="Are you sure you want to delete this document?"
              okText="Yes"
              cancelText="No"
              onConfirm={() => handleDeleteDoc(record._id)}
            >
              <Button type="link" danger style={{ padding: 0 }} disabled={demoDisabled}>Delete</Button>
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
      <Button
        type="primary"
        style={{ marginBottom: 16 }}
        onClick={() => setAddModalVisible(true)}
        disabled={demoDisabled}
      >
        Add Document
      </Button>

      {/* DTR History */}
      {dtrDocs.length > 0 && (
        <>
          <h3>DTR History</h3>
          <Table
            columns={columns}
            dataSource={dtrDocs}
            rowKey={(record) => record._id}
            pagination={{ pageSize: 10 }}
            bordered
            size="small"
          />
        </>
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
      <Modal
        title="Add Document"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => (!demoDisabled ? form.submit() : message.warning("Action disabled in demo mode"))}
        okText="Save"
        okButtonProps={{ disabled: demoDisabled }}
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
            <Select disabled={demoDisabled}>
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
            <Input placeholder="R3-2025-0***** or Google Drive/OneDrive link" disabled={demoDisabled} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" disabled={demoDisabled} />
          </Form.Item>

          <Form.Item name="period" label="Period (optional)">
            <Input placeholder="e.g. July 2025" disabled={demoDisabled} />
          </Form.Item>

          <Form.Item name="dateIssued" label="Date Issued (optional)">
            <DatePicker style={{ width: "100%" }} disabled={demoDisabled} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OtherDetails;