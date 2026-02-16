import {
  Modal,
  Upload,
  Button,
  Table,
  Input,
  DatePicker,
  Form,
  Alert,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { swalSuccess, swalError, swalWarning } from "../../utils/swalHelper";
import * as XLSX from "xlsx";
import PropTypes from "prop-types";
import { useState } from "react";
import useDemoMode from "../../hooks/useDemoMode";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import axios from "../../api/axiosInstance";

dayjs.extend(customParseFormat);

import "./importdtrmodal.css";

const requiredHeaders = [
  "AC-No",
  "Name",
  "Time",
  "State",
  "New State",
  "Exception",
];

const { Dragger } = Upload;
const { RangePicker } = DatePicker;

const EditableCell = ({
  editing,
  dataIndex,
  title,
  record,
  children,
  inputType, // destructure so it is not forwarded to the DOM
  ...restProps
}) => (
  <td {...restProps}>
    {editing ? (
      <Form.Item
        name={dataIndex}
        style={{ margin: 0 }}
        rules={[
          {
            required: ["AC-No", "Name", "Time", "State"].includes(dataIndex),
            message: `${title} is required`,
          },
        ]}
      >
        <Input />
      </Form.Item>
    ) : (
      children
    )}
  </td>
);

const ImportDTRModal = ({ open, onClose, currentUser, isDemo }) => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]); // NEW for search
  const [columns, setColumns] = useState([]);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [submitForm] = Form.useForm();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isEditing = (record) => record.key === editingKey;

  const edit = (record) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.key);
  };

  const save = async (key) => {
    try {
      const row = await form.validateFields();
      const newData = [...data];
      const index = newData.findIndex((item) => key === item.key);
      if (index > -1) {
        newData.splice(index, 1, { ...newData[index], ...row });
        setData(newData);
        setFilteredData(newData);
        setEditingKey("");
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const cancel = () => {
    setEditingKey("");
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataArr = new Uint8Array(e.target.result);
      const workbook = XLSX.read(dataArr, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const normalizeHeader = (h) =>
        (h || "")
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\u00A0/g, " ")
          .replace(/\s+/g, " ")
          .replace(/[.\s]+$/, "");

      const rawHeaders = jsonData[0].map(normalizeHeader);

      // FIX: consistent normalization
      const headerIndexMap = {};
      requiredHeaders.forEach((h) => {
        const normalized = normalizeHeader(h);
        headerIndexMap[h] = rawHeaders.indexOf(normalized);
      });

      let body = jsonData.slice(1).map((row, i) => {
        const obj = { key: i };
        requiredHeaders.forEach((h) => {
          let value =
            headerIndexMap[h] >= 0 ? row[headerIndexMap[h]] ?? "" : "";

          if (h === "Time" && value) {
            let isoDate = null;
            if (typeof value === "number") {
              const parsedDate = XLSX.SSF.parse_date_code(value);
              if (parsedDate) {
                isoDate = new Date(
                  parsedDate.y,
                  parsedDate.m - 1,
                  parsedDate.d,
                  parsedDate.H,
                  parsedDate.M,
                  parsedDate.S
                ).toISOString();
              }
            } else {
              const raw = String(value).trim();
              // Try native Date first
              let jsDate = new Date(raw);
              if (isNaN(jsDate)) {
                // Try common date formats via dayjs
                const fmts = [
                  "MM/DD/YYYY hh:mm:ss A",
                  "MM/DD/YYYY hh:mm A",
                  "MM/DD/YYYY HH:mm:ss",
                  "MM/DD/YYYY HH:mm",
                  "M/D/YYYY h:mm:ss A",
                  "M/D/YYYY h:mm A",
                  "M/D/YYYY H:mm:ss",
                  "M/D/YYYY H:mm",
                  "DD/MM/YYYY hh:mm:ss A",
                  "DD/MM/YYYY HH:mm:ss",
                  "DD/MM/YYYY HH:mm",
                  "YYYY-MM-DD HH:mm:ss",
                  "YYYY-MM-DD HH:mm",
                  "YYYY/MM/DD HH:mm:ss",
                ];
                for (const fmt of fmts) {
                  const d = dayjs(raw, fmt, true);
                  if (d.isValid()) {
                    jsDate = d.toDate();
                    break;
                  }
                }
              }
              if (!isNaN(jsDate)) isoDate = jsDate.toISOString();
            }
            obj[h] = isoDate
              ? dayjs(isoDate).format("MM/DD/YYYY hh:mm A")
              : value.toString(); // fallback to raw string
            obj["TimeISO"] = isoDate || "";
          } else {
            obj[h] = value;
          }
        });
        return obj;
      });

      // Deduplicate: use AC-No + TimeISO + State so different punch types are preserved
      const seen = new Set();
      body = body
        .filter((row) =>
          requiredHeaders.some((h) => row[h] !== undefined && row[h] !== "")
        )
        .filter((row) => {
          const key = `${row["AC-No"] || ""}_${row.Name}_${row.TimeISO || row.Time || ""}_${row.State || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      setData(body);
      setFilteredData(body); // sync with searchable data
      setColumns(
        requiredHeaders.map((header) => ({
          title: header,
          dataIndex: header,
          editable: true,
        }))
      );
      setFileUploaded(true);
      setHasSubmitted(false);
    };

    reader.readAsArrayBuffer(file);
    return false;
  };

  const openSubmitModal = () => {
    if (uploading || hasSubmitted) {
      swalWarning("Upload in progress or already submitted.");
      return;
    }
    const hasEmptyRequired = data.some((row) =>
      ["AC-No", "Name", "Time", "State"].some(
        (field) => !row[field] || row[field].toString().trim() === ""
      )
    );
    if (hasEmptyRequired) {
      swalError("Please fill all required fields before submitting.");
      return;
    }
    // In demo, enforce a safe max rows limit to keep UX responsive
    if (isDemo && data.length > 1500) {
      swalWarning("Demo mode: Limiting to first 1500 records for simulation.");
      setFilteredData((prev) => prev.slice(0, 1500));
      setData((prev) => prev.slice(0, 1500));
    }
    submitForm.resetFields();
    setSubmitModalVisible(true);
  };

  const handleSubmitModalOk = async () => {
    if (hasSubmitted) return;
    try {
      const values = await submitForm.validateFields();

      const seen = new Set();
      const uniqueRows = data.filter((row) => {
        const key = `${row["AC-No"] || ""}_${row.Name}_${row.TimeISO || row.Time || ""}_${row.State || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const uploadRows = uniqueRows.map((row) => ({
        ...row,
        Time: row.TimeISO || row.Time,
        TimeISO: undefined,
        key: undefined,
      }));

      const payload = {
        recordName: values.recordName,
        cutOffStart: values.cutOffRange[0].startOf("day").toISOString(),
        cutOffEnd: values.cutOffRange[1].endOf("day").toISOString(),
        userId: currentUser._id,
        uploadedBy: currentUser.name,
        rows: uploadRows, // server expects `rows`
      };

      setUploading(true);
      setHasSubmitted(true);

      // In demo mode: simulate success without uploading to server
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 600));
        swalSuccess("Demo mode: Import simulated successfully (no data saved).");
        // Log demo import for diagnostics (non-blocking)
        try {
          const total = uploadRows.length;
          await axios.post("/public/demo-import-log", {
            userId: currentUser?._id,
            uploadedBy: currentUser?.name,
            totalRecords: total,
            cutOffStart: values.cutOffRange?.[0]?.toISOString?.() || undefined,
            cutOffEnd: values.cutOffRange?.[1]?.toISOString?.() || undefined,
            note: "import-biometrics-simulated",
          });
        } catch (_) { /* ignore logging failure */ }
        setFileUploaded(false);
        setData([]);
        setFilteredData([]);
        setColumns([]);
        setSubmitModalVisible(false);
        onClose();
      } else {
        const res = await axios.post("/dtr/upload", payload);
        if (res.status === 200) {
          swalSuccess("DTR Data imported successfully.");
          setFileUploaded(false);
          setData([]);
          setFilteredData([]);
          setColumns([]);
          setSubmitModalVisible(false);
          onClose();
        } else {
          swalError("Unexpected response from server.");
          setHasSubmitted(false);
        }
      }
    } catch (err) {
      console.error(err);
      swalError("Error submitting DTR data.");
      setHasSubmitted(false);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitModalCancel = () => {
    setSubmitModalVisible(false);
  };

  const handleReupload = () => {
    setData([]);
    setFilteredData([]);
    setFileUploaded(false);
    setEditingKey("");
    setHasSubmitted(false);
    form.resetFields();
  };

  const mergedColumns = columns.map((col) => {
    if (!col.editable) return col;
    return {
      ...col,
      onCell: (record) => ({
        record,
        inputType: "text",
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  return (
    <>
      <Modal
        title="Import DTR"
        open={open}
        onCancel={onClose}
        footer={null}
        width={1000}
      >
        {isDemo && (
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            showIcon
            message="Demo Simulation"
            description="This is a demo environment. Import will simulate success and will not save any data."
          />
        )}
        {!fileUploaded && (
          <Dragger
            beforeUpload={parseExcel}
            accept=".xlsx,.xls"
            showUploadList={false}
            maxCount={1}
            multiple={false}
            disabled={uploading}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint">
              Only Excel (.xlsx, .xls) and CSV files are supported.
            </p>
          </Dragger>
        )}

        {fileUploaded && (
          <Form form={form} component={false}>
            {/* Search + Re-upload bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Input.Search
                placeholder="Search by Name"
                allowClear
                onSearch={(value) => {
                  if (!value) {
                    setFilteredData(data);
                  } else {
                    setFilteredData(
                      data.filter((row) =>
                        row.Name?.toLowerCase().includes(value.toLowerCase())
                      )
                    );
                  }
                }}
                style={{ width: 220 }}
                size="small"
              />
              <span style={{ fontSize: 12, color: "#666" }}>
                Total Records: <b>{filteredData.length}</b>
                {filteredData.length !== data.length && (
                  <> (of {data.length})</>)}
              </span>
              <Button onClick={handleReupload} disabled={uploading} size="small">
                Re-upload Excel File
              </Button>
            </div>

            <Table
              components={{
                body: { cell: EditableCell },
              }}
              bordered
              dataSource={filteredData}
              size="small"
              className="import-dtr-table"
              scroll={{ y: 380 }}
              columns={[
                ...mergedColumns,
                {
                  title: "Action",
                  dataIndex: "action",
                  width: 80,
                  render: (_, record) => {
                    const editable = isEditing(record);
                    return editable ? (
                      <span>
                        <a
                          onClick={() => save(record.key)}
                          style={{ marginRight: 8 }}
                        >
                          Save
                        </a>
                        <a onClick={cancel}>Cancel</a>
                      </span>
                    ) : (
                      <a
                        disabled={editingKey !== ""}
                        onClick={() => edit(record)}
                      >
                        Edit
                      </a>
                    );
                  },
                },
              ]}
              rowClassName={(record) => {
                const missingRequired = ["AC-No", "Name", "Time", "State"].some(
                  (f) => !record[f] || record[f].toString().trim() === ""
                );
                return missingRequired ? "table-row-error" : "";
              }}
              pagination={{
                defaultPageSize: 20,
                pageSizeOptions: [10, 20, 50, 100, 200],
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} records`,
                size: "small",
              }}
            />

            <Button
              type="primary"
              style={{ marginTop: 16 }}
              onClick={openSubmitModal}
              disabled={uploading || hasSubmitted}
            >
              Submit / Save Dataset
            </Button>
          </Form>
        )}
      </Modal>

      {/* Submit Modal */}
      <Modal
        title="Save Dataset"
        open={submitModalVisible}
        onOk={handleSubmitModalOk}
        onCancel={handleSubmitModalCancel}
        okText="Save"
        confirmLoading={uploading}
      >
        <Form form={submitForm} layout="vertical" name="submitForm">
          <Form.Item
            label="Dataset Name"
            name="recordName"
            rules={[{ required: true, message: "Please input dataset name" }]}
          >
            <Input placeholder="Enter dataset name" />
          </Form.Item>

          <Form.Item
            label="Cutoff Date Range"
            name="cutOffRange"
            rules={[{ required: true, message: "Please select cutoff date range" }]}
          >
            <RangePicker format="MM/DD/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

ImportDTRModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  isDemo: PropTypes.bool,
};

export default ImportDTRModal;
