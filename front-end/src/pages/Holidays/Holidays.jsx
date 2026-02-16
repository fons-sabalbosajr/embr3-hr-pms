import React, { useEffect, useState, useRef } from "react";
import {
  Tabs,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Typography,
  Upload,
  Switch,
  Grid,
  TimePicker,
  Tag,
  Tooltip,
  AutoComplete,
} from "antd";
import { UploadOutlined, LinkOutlined, TeamOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import axiosInstance from "../../api/axiosInstance";
import { fetchPhilippineHolidays } from "../../api/holidayPH";
import useDemoMode from "../../hooks/useDemoMode";
import { swalSuccess, swalError, swalWarning, swalInfo } from "../../utils/swalHelper";
import useLoading from "../../hooks/useLoading";
import { secureSessionGet, secureSessionStore } from "../../../utils/secureStorage";

const { RangePicker } = DatePicker;

const NationalHolidays = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [year, setYear] = useState(dayjs().year());
  const [data, setData] = useState([]);
  useEffect(() => {
    (async () => {
      const res = await fetchPhilippineHolidays(year);
      setData(
        res.map((h, idx) => ({
          key: idx,
          date: h.date,
          name: h.localName,
          type: h.type,
        }))
      );
    })();
  }, [year]);
  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <DatePicker
          picker="year"
          value={dayjs(String(year))}
          onChange={(d) => setYear(d?.year() || dayjs().year())}
        />
      </Space>
      <div style={{ overflowX: 'auto' }}>
        <Table
          className="compact-table"
          size="small"
          pagination={false}
          dataSource={data}
          scroll={{ x: isMobile ? 400 : undefined }}
          columns={[
            {
              title: "Date",
              dataIndex: "date",
              key: "date",
              width: isMobile ? 110 : undefined,
              render: (d) => dayjs(d).format("YYYY-MM-DD"),
            },
            { title: "Name", dataIndex: "name", key: "name" },
            { title: "Type", dataIndex: "type", key: "type", width: isMobile ? 80 : undefined },
          ]}
        />
      </div>
    </div>
  );
};

const LocalHolidays = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { isDemoActive, isDemoUser } = useDemoMode();
  const { withLoading } = useLoading();
  const DEMO_SESSION_KEY = "__demo_new_local_holiday__";
  const [demoNewIds, setDemoNewIds] = useState(() => {
    try {
      return secureSessionGet(DEMO_SESSION_KEY) || [];
    } catch {
      return [];
    }
  });
  const markSessionNew = (id) => {
    if (!id) return;
    setDemoNewIds((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = Array.from(new Set([...base, id]));
      try {
        secureSessionStore(DEMO_SESSION_KEY, next);
      } catch {}
      return next;
    });
  };
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = async () => {
    const { data } = await axiosInstance.get("/local-holidays");
    setList((data?.data || []).map((d) => ({ key: d._id, ...d })));
  };
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      date: values.range ? values.range[0] : values.date,
      endDate: values.range ? values.range[1] : undefined,
      location: values.location,
      notes: values.notes,
    };
    const res = await axiosInstance.post("/local-holidays", payload);
    if (isDemoActive && isDemoUser && res?.data?.data?._id) {
      markSessionNew(res.data.data._id);
    }
    swalSuccess("Local holiday saved");
    setOpen(false);
    form.resetFields();
    load();
  };

  const remove = async (record) => {
    if (isDemoActive && isDemoUser && !demoNewIds.includes(record.key)) {
      swalWarning(
        "Delete is disabled in demo mode. You can only delete items you added this session."
      );
      return;
    }
    await axiosInstance.delete(`/local-holidays/${record.key}`);
    swalSuccess("Deleted");
    load();
  };

  const startEdit = (record) => {
    setEditing(record);
    editForm.setFieldsValue({
      name: record.name,
      date: record.date ? dayjs(record.date) : null,
      range: record.endDate
        ? [dayjs(record.date), dayjs(record.endDate)]
        : undefined,
      location: record.location,
      notes: record.notes,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const values = await editForm.validateFields();
    const payload = {
      name: values.name,
      date: values.range ? values.range[0] : values.date,
      endDate: values.range ? values.range[1] : undefined,
      location: values.location,
      notes: values.notes,
    };
    await axiosInstance.put(`/local-holidays/${editing.key}`, payload);
    swalSuccess("Updated");
    setEditOpen(false);
    setEditing(null);
    load();
  };

  const parseFile = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const data = await file.arrayBuffer();
    let rows = [];
    if (["xlsx", "xls"].includes(ext)) {
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else if (ext === "csv") {
      const text = new TextDecoder().decode(data);
      const [headerLine, ...lines] = text
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const headers = headerLine.split(",").map((h) => h.trim());
      rows = lines.map((line) => {
        const cols = line.split(",");
        const obj = {};
        headers.forEach((h, i) => (obj[h] = cols[i]));
        return obj;
      });
    } else {
      throw new Error("Unsupported file type");
    }
    return rows;
  };

  const handleBulkFile = async ({ file }) => {
    setUploading(true);
    try {
      const rows = await parseFile(file);
      if (!rows.length) throw new Error("No rows parsed");
      setPreviewRows(rows);
      setPreviewModalOpen(true);
      swalInfo(`${rows.length} rows parsed. Preview before confirm.`);
    } catch (e) {
      swalError(e.message || "Failed to parse file");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const confirmBulkUpload = async () => {
    await withLoading(async ({ updateProgress }) => {
      try {
        updateProgress(20, "Uploading holidays…");
        await axiosInstance.post("/local-holidays/bulk-upload", {
          rows: previewRows,
        });
        updateProgress(90, "Finalising…");
        swalSuccess("Bulk upload complete");
        setPreviewModalOpen(false);
        setBulkOpen(false);
        setPreviewRows([]);
        load();
      } catch (e) {
        swalError(e?.response?.data?.message || "Bulk upload failed");
      }
    }, "Uploading holidays…");
  };

  return (
    <div>
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Button type="primary" size={isMobile ? 'small' : 'middle'} onClick={() => setOpen(true)}>
          Add Local Holiday
        </Button>
        <Button size={isMobile ? 'small' : 'middle'} onClick={() => setBulkOpen(true)}>Bulk Upload CSV/Excel</Button>
      </Space>
      <div style={{ overflowX: 'auto' }}>
        <Table
          className="compact-table"
          size="small"
          dataSource={list}
          rowKey="key"
          scroll={{ x: isMobile ? 500 : undefined }}
          columns={[
            { title: "Name", dataIndex: "name", width: isMobile ? 120 : undefined },
            {
              title: "Date",
              dataIndex: "date",
              width: isMobile ? 110 : undefined,
              render: (d, r) =>
                r.endDate
                  ? `${dayjs(d).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format(
                      "YYYY-MM-DD"
                    )}`
                  : dayjs(d).format("YYYY-MM-DD"),
            },
            ...(!isMobile ? [{ title: "Location", dataIndex: "location" }] : []),
            ...(!isMobile ? [{ title: "Notes", dataIndex: "notes" }] : []),
            {
              title: "Action",
              key: "action",
              width: isMobile ? 120 : undefined,
              render: (_, r) => {
                const deleteDisabled =
                  isDemoActive && isDemoUser && !demoNewIds.includes(r.key);
                return (
                  <Space size={isMobile ? 4 : 8}>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => startEdit(r)}
                    >
                      Edit
                    </Button>
                    <Button
                      danger
                      size="small"
                      disabled={deleteDisabled}
                      onClick={() => remove(r)}
                    >
                      Del
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />
      </div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        title="Add Local Holiday"
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Date Range"
            name="range"
            tooltip="Choose a range for multi-day holidays"
          >
            <RangePicker />
          </Form.Item>
          <Form.Item label="Or Single Date" name="date">
            <DatePicker />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input placeholder="e.g., EMBR3, Region, City" />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onOk={submitEdit}
        title={`Edit Local Holiday`}
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Date Range" name="range">
            <RangePicker />
          </Form.Item>
          <Form.Item label="Or Single Date" name="date">
            <DatePicker />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        footer={null}
        title="Bulk Upload Local Holidays (CSV/Excel)"
      >
        <p style={{ marginBottom: 8 }}>
          Columns: name | date or startDate/from | endDate/to (optional) |
          location (optional) | notes (optional)
        </p>
        <Upload
          beforeUpload={(file) => handleBulkFile({ file })}
          showUploadList={false}
          disabled={uploading}
          accept=".csv,.xlsx,.xls"
        >
          <Button icon={<UploadOutlined />} loading={uploading}>
            Select CSV / Excel File
          </Button>
        </Upload>
      </Modal>

      <Modal
        width={800}
        open={previewModalOpen}
        onCancel={() => {
          setPreviewModalOpen(false);
        }}
        onOk={confirmBulkUpload}
        title="Preview Local Holidays"
      >
        <Table
          className="compact-table"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
          }}
          dataSource={previewRows.map((r, i) => ({ key: i, ...r }))}
          columns={Object.keys(previewRows[0] || {}).map((k) => ({
            title: k,
            dataIndex: k,
          }))}
        />
      </Modal>
    </div>
  );
};

const { Title, Paragraph } = Typography;

const Suspensions = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { isDemoActive, isDemoUser } = useDemoMode();
  const { withLoading } = useLoading();
  const DEMO_SESSION_KEY = "__demo_new_suspension__";
  const [demoNewIds, setDemoNewIds] = useState(() => {
    try {
      return secureSessionGet(DEMO_SESSION_KEY) || [];
    } catch {
      return [];
    }
  });
  const markSessionNew = (id) => {
    if (!id) return;
    setDemoNewIds((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = Array.from(new Set([...base, id]));
      try {
        secureSessionStore(DEMO_SESSION_KEY, next);
      } catch {}
      return next;
    });
  };
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = async () => {
    const { data } = await axiosInstance.get("/suspensions");
    setList((data?.data || []).map((d) => ({ key: d._id, ...d })));
  };
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      title: values.title,
      date: values.range ? values.range[0] : values.date,
      endDate: values.range ? values.range[1] : undefined,
      scope: values.scope,
      location: values.location,
      referenceType: values.referenceType,
      referenceNo: values.referenceNo,
      notes: values.notes,
    };
    const res = await axiosInstance.post("/suspensions", payload);
    if (isDemoActive && isDemoUser && res?.data?.data?._id) {
      markSessionNew(res.data.data._id);
    }
    swalSuccess("Suspension saved");
    setOpen(false);
    form.resetFields();
    load();
  };

  const remove = async (record) => {
    if (isDemoActive && isDemoUser && !demoNewIds.includes(record.key)) {
      swalWarning(
        "Delete is disabled in demo mode. You can only delete items you added this session."
      );
      return;
    }
    await axiosInstance.delete(`/suspensions/${record.key}`);
    swalSuccess("Deleted");
    load();
  };

  const startEdit = (record) => {
    setEditing(record);
    editForm.setFieldsValue({
      title: record.title,
      date: record.date ? dayjs(record.date) : null,
      range: record.endDate
        ? [dayjs(record.date), dayjs(record.endDate)]
        : undefined,
      scope: record.scope,
      location: record.location,
      referenceType: record.referenceType,
      referenceNo: record.referenceNo,
      notes: record.notes,
      active: record.active !== false,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const values = await editForm.validateFields();
    const payload = {
      title: values.title,
      date: values.range ? values.range[0] : values.date,
      endDate: values.range ? values.range[1] : undefined,
      scope: values.scope,
      location: values.location,
      referenceType: values.referenceType,
      referenceNo: values.referenceNo,
      notes: values.notes,
      active: values.active,
    };
    await axiosInstance.put(`/suspensions/${editing.key}`, payload);
    swalSuccess("Updated");
    setEditOpen(false);
    setEditing(null);
    load();
  };

  const parseFile = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const data = await file.arrayBuffer();
    let rows = [];
    if (["xlsx", "xls"].includes(ext)) {
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else if (ext === "csv") {
      const text = new TextDecoder().decode(data);
      const [headerLine, ...lines] = text
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const headers = headerLine.split(",").map((h) => h.trim());
      rows = lines.map((line) => {
        const cols = line.split(",");
        const obj = {};
        headers.forEach((h, i) => (obj[h] = cols[i]));
        return obj;
      });
    } else {
      throw new Error("Unsupported file type");
    }
    return rows;
  };

  const handleBulkFile = async ({ file }) => {
    setUploading(true);
    try {
      const rows = await parseFile(file);
      if (!rows.length) throw new Error("No rows parsed");
      setPreviewRows(rows);
      setPreviewModalOpen(true);
      swalInfo(`${rows.length} rows parsed. Preview before confirm.`);
    } catch (e) {
      swalError(e.message || "Failed to parse file");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const confirmBulkUpload = async () => {
    await withLoading(async ({ updateProgress }) => {
      try {
        updateProgress(20, "Uploading suspensions…");
        await axiosInstance.post("/suspensions/bulk-upload", {
          rows: previewRows,
        });
        updateProgress(90, "Finalising…");
        swalSuccess("Bulk upload complete");
        setPreviewModalOpen(false);
        setBulkOpen(false);
        setPreviewRows([]);
        load();
      } catch (e) {
        swalError(e?.response?.data?.message || "Bulk upload failed");
      }
    }, "Uploading suspensions…");
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 8 }}>
        Suspension Days
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12, fontSize: isMobile ? 12 : 14 }}>
        Manage suspension days (temporary office closures or suspensions). Use
        the Add Suspension button to create a new suspension record; these
        entries will be used when calculating DTRs and reports.
      </Paragraph>
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Button type="primary" size={isMobile ? 'small' : 'middle'} onClick={() => setOpen(true)}>
          Add Suspension
        </Button>
        <Button size={isMobile ? 'small' : 'middle'} onClick={() => setBulkOpen(true)}>Bulk Upload CSV/Excel</Button>
      </Space>
      <div style={{ overflowX: 'auto' }}>
        <Table
          className="compact-table"
          size="small"
          dataSource={list}
          rowKey="key"
          scroll={{ x: isMobile ? 500 : 800 }}
          columns={[
            { title: "Title", dataIndex: "title", width: isMobile ? 120 : undefined },
            {
              title: "Date",
              dataIndex: "date",
              width: isMobile ? 110 : undefined,
              render: (d, r) =>
                r.endDate
                  ? `${dayjs(d).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format(
                      "YYYY-MM-DD"
                    )}`
                  : dayjs(d).format("YYYY-MM-DD"),
            },
            ...(!isMobile ? [{ title: "Scope", dataIndex: "scope" }] : []),
            ...(!isMobile ? [{
              title: "Reference",
              key: "ref",
              render: (_, r) => `${r.referenceType || ""} ${r.referenceNo || ""}`,
            }] : []),
            ...(!isMobile ? [{ title: "Location", dataIndex: "location" }] : []),
            ...(!isMobile ? [{ title: "Notes", dataIndex: "notes" }] : []),
            {
              title: "Active",
              dataIndex: "active",
              width: isMobile ? 70 : undefined,
              render: (v) => (v === false ? "Inactive" : "Active"),
            },
            {
              title: "Action",
              key: "action",
              width: isMobile ? 120 : undefined,
              render: (_, r) => {
                const deleteDisabled =
                  isDemoActive && isDemoUser && !demoNewIds.includes(r.key);
                return (
                  <Space size={isMobile ? 4 : 8}>
                    <Button size="small" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      danger
                      size="small"
                      disabled={deleteDisabled}
                      onClick={() => remove(r)}
                    >
                      Del
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />
      </div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        title="Add Suspension Day"
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Date Range" name="range">
            <RangePicker />
          </Form.Item>
          <Form.Item label="Or Single Date" name="date">
            <DatePicker />
          </Form.Item>
          <Form.Item label="Scope" name="scope" initialValue="Local">
            <Select
              options={[
                { value: "National" },
                { value: "Regional" },
                { value: "Local" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input placeholder="e.g., EMBR3, Region, City" />
          </Form.Item>
          <Form.Item
            label="Reference Type"
            name="referenceType"
            initialValue="Memorandum"
          >
            <Select
              options={[
                { value: "Memorandum" },
                { value: "Proclamation" },
                { value: "Order" },
                { value: "Other" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Reference No." name="referenceNo">
            <Input />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onOk={submitEdit}
        title={`Edit Suspension`}
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Date Range" name="range">
            <RangePicker />
          </Form.Item>
          <Form.Item label="Or Single Date" name="date">
            <DatePicker />
          </Form.Item>
          <Form.Item label="Scope" name="scope">
            <Select
              options={[
                { value: "National" },
                { value: "Regional" },
                { value: "Local" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input />
          </Form.Item>
          <Form.Item label="Reference Type" name="referenceType">
            <Select
              options={[
                { value: "Memorandum" },
                { value: "Proclamation" },
                { value: "Order" },
                { value: "Other" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Reference No." name="referenceNo">
            <Input />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Active" name="active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        footer={null}
        title="Bulk Upload Suspensions (CSV/Excel)"
      >
        <p style={{ marginBottom: 8 }}>
          Columns: title | date or startDate/from | endDate/to (optional) |
          scope | location (optional) | referenceType (optional) | referenceNo
          (optional) | notes (optional) | active (optional)
        </p>
        <Upload
          beforeUpload={(file) => handleBulkFile({ file })}
          showUploadList={false}
          disabled={uploading}
          accept=".csv,.xlsx,.xls"
        >
          <Button icon={<UploadOutlined />} loading={uploading}>
            Select CSV / Excel File
          </Button>
        </Upload>
      </Modal>

      <Modal
        width={800}
        open={previewModalOpen}
        onCancel={() => {
          setPreviewModalOpen(false);
        }}
        onOk={confirmBulkUpload}
        title="Preview Suspensions"
      >
        <Table
          className="compact-table"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
          }}
          dataSource={previewRows.map((r, i) => ({ key: i, ...r }))}
          columns={Object.keys(previewRows[0] || {}).map((k) => ({
            title: k,
            dataIndex: k,
          }))}
        />
      </Modal>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   WORK FROM HOME TAB
   ═══════════════════════════════════════════════════════════════════ */
const WorkFromHome = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { isDemoActive, isDemoUser } = useDemoMode();
  const DEMO_SESSION_KEY = "__demo_new_wfh__";
  const [demoNewIds, setDemoNewIds] = useState(() => {
    try {
      return secureSessionGet(DEMO_SESSION_KEY) || [];
    } catch {
      return [];
    }
  });
  const markSessionNew = (id) => {
    if (!id) return;
    setDemoNewIds((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = Array.from(new Set([...base, id]));
      try {
        secureSessionStore(DEMO_SESSION_KEY, next);
      } catch {}
      return next;
    });
  };

  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [attachmentData, setAttachmentData] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editAttachmentData, setEditAttachmentData] = useState(null);

  /* ── Employee autocomplete ── */
  const [empOptions, setEmpOptions] = useState([]);
  const [empSearching, setEmpSearching] = useState(false);
  const empSearchRef = useRef();

  const handleEmpSearch = (value) => {
    if (empSearchRef.current) clearTimeout(empSearchRef.current);
    if (!value || value.length < 2) {
      setEmpOptions([]);
      return;
    }
    empSearchRef.current = setTimeout(async () => {
      try {
        setEmpSearching(true);
        const { data } = await axiosInstance.get("/employees/public/search", {
          params: { q: value },
        });
        const rows = data?.data || [];
        setEmpOptions(
          rows.map((r) => ({
            value: r.empId,
            empName: r.name,
            label: `${r.empId} — ${r.name}`,
          }))
        );
      } catch (_) {
        setEmpOptions([]);
      } finally {
        setEmpSearching(false);
      }
    }, 300);
  };

  const handleEmpSelect = (val, option, targetForm) => {
    targetForm.setFieldsValue({
      empId: option.value,
      employeeName: option.empName || "",
    });
  };

  const load = async () => {
    try {
      const { data } = await axiosInstance.get("/work-from-home");
      setList((data?.data || []).map((d) => ({ key: d._id, ...d })));
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to load WFH records");
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ── Upload file to Google Drive ── */
  const handleUploadFile = async (file, isEdit = false) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axiosInstance.post("/work-from-home/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success) {
        const info = res.data.data;
        if (isEdit) {
          setEditAttachmentData(info);
        } else {
          setAttachmentData(info);
        }
        swalSuccess("File uploaded to Google Drive");
      }
    } catch (e) {
      const msg = e?.response?.data?.message || "File upload failed";
      swalWarning(
        `${msg}. You can still save the WFH record without an attachment.`
      );
    } finally {
      setUploading(false);
    }
    return false; // prevent default antd upload
  };

  /* ── Create ── */
  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        empId: values.empId || "",
        employeeName: values.employeeName || "",
        date: values.range ? values.range[0] : values.date,
        endDate: values.range ? values.range[1] : undefined,
        timeIn: values.timeIn ? values.timeIn.format("h:mm A") : "",
        breakOut: values.breakOut ? values.breakOut.format("h:mm A") : "",
        breakIn: values.breakIn ? values.breakIn.format("h:mm A") : "",
        timeOut: values.timeOut ? values.timeOut.format("h:mm A") : "",
        notes: values.notes || "",
      };
      if (attachmentData) {
        payload.attachmentUrl = attachmentData.attachmentUrl;
        payload.attachmentName = attachmentData.attachmentName;
        payload.attachmentDriveId = attachmentData.attachmentDriveId;
      }
      const res = await axiosInstance.post("/work-from-home", payload);
      if (isDemoActive && isDemoUser && res?.data?.data?._id) {
        markSessionNew(res.data.data._id);
      }
      swalSuccess("Work From Home record saved");
      setOpen(false);
      form.resetFields();
      setAttachmentData(null);
      load();
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to save WFH record");
    }
  };

  /* ── Delete ── */
  const removeRecord = async (record) => {
    if (isDemoActive && isDemoUser && !demoNewIds.includes(record.key)) {
      swalWarning(
        "Delete is disabled in demo mode. You can only delete items you added this session."
      );
      return;
    }
    try {
      await axiosInstance.delete(`/work-from-home/${record.key}`);
      swalSuccess("Deleted");
      load();
    } catch (e) {
      swalError(e?.response?.data?.message || "Delete failed");
    }
  };

  /* ── Edit ── */
  const startEdit = (record) => {
    setEditing(record);
    setEditAttachmentData(
      record.attachmentUrl
        ? {
            attachmentUrl: record.attachmentUrl,
            attachmentName: record.attachmentName,
            attachmentDriveId: record.attachmentDriveId,
          }
        : null
    );
    editForm.setFieldsValue({
      empId: record.empId,
      employeeName: record.employeeName,
      date: record.date ? dayjs(record.date) : null,
      range: record.endDate
        ? [dayjs(record.date), dayjs(record.endDate)]
        : undefined,
      timeIn: record.timeIn ? dayjs(record.timeIn, "h:mm A") : null,
      breakOut: record.breakOut ? dayjs(record.breakOut, "h:mm A") : null,
      breakIn: record.breakIn ? dayjs(record.breakIn, "h:mm A") : null,
      timeOut: record.timeOut ? dayjs(record.timeOut, "h:mm A") : null,
      notes: record.notes,
      active: record.active !== false,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const payload = {
        empId: values.empId,
        employeeName: values.employeeName,
        date: values.range ? values.range[0] : values.date,
        endDate: values.range ? values.range[1] : undefined,
        timeIn: values.timeIn ? values.timeIn.format("h:mm A") : "",
        breakOut: values.breakOut ? values.breakOut.format("h:mm A") : "",
        breakIn: values.breakIn ? values.breakIn.format("h:mm A") : "",
        timeOut: values.timeOut ? values.timeOut.format("h:mm A") : "",
        notes: values.notes || "",
        active: values.active,
      };
      if (editAttachmentData) {
        payload.attachmentUrl = editAttachmentData.attachmentUrl;
        payload.attachmentName = editAttachmentData.attachmentName;
        payload.attachmentDriveId = editAttachmentData.attachmentDriveId;
      }
      await axiosInstance.put(`/work-from-home/${editing.key}`, payload);
      swalSuccess("Updated");
      setEditOpen(false);
      setEditing(null);
      setEditAttachmentData(null);
      load();
    } catch (e) {
      swalError(e?.response?.data?.message || "Update failed");
    }
  };

  /* ── Time picker helper ── */
  const timeFormat = "h:mm A";

  /* ═══════════════════════════════════════════════════════════════════
     WFH GROUP STATE + HANDLERS
     ═══════════════════════════════════════════════════════════════════ */
  const [wfhGroups, setWfhGroups] = useState([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupAddOpen, setGroupAddOpen] = useState(false);
  const [groupEditOpen, setGroupEditOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm] = Form.useForm();
  const [groupEditForm] = Form.useForm();

  /* ── Employee multi-search for groups ── */
  const [groupEmpOptions, setGroupEmpOptions] = useState([]);
  const [groupEmpSearching, setGroupEmpSearching] = useState(false);
  const groupEmpSearchRef = useRef();

  const handleGroupEmpSearch = (value) => {
    if (groupEmpSearchRef.current) clearTimeout(groupEmpSearchRef.current);
    if (!value || value.length < 2) {
      setGroupEmpOptions([]);
      return;
    }
    groupEmpSearchRef.current = setTimeout(async () => {
      try {
        setGroupEmpSearching(true);
        const { data } = await axiosInstance.get("/employees/public/search", {
          params: { q: value },
        });
        const rows = data?.data || [];
        setGroupEmpOptions(
          rows.map((r) => ({
            value: r.empId,
            label: `${r.empId} — ${r.name}`,
            empName: r.name,
          }))
        );
      } catch (_) {
        setGroupEmpOptions([]);
      } finally {
        setGroupEmpSearching(false);
      }
    }, 300);
  };

  const loadGroups = async () => {
    try {
      const { data } = await axiosInstance.get("/wfh-groups");
      setWfhGroups((data?.data || []).map((d) => ({ key: d._id, ...d })));
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to load WFH groups");
    }
  };

  useEffect(() => {
    if (groupModalOpen) loadGroups();
  }, [groupModalOpen]);

  const submitGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      const members = (values.members || []).map((m) => {
        const opt = groupEmpOptions.find((o) => o.value === m);
        return { empId: m, employeeName: opt?.empName || m };
      });
      const payload = {
        name: values.name || "",
        startDate: values.range[0],
        endDate: values.range[1],
        members,
        notes: values.notes || "",
      };
      await axiosInstance.post("/wfh-groups", payload);
      swalSuccess("WFH Group created");
      setGroupAddOpen(false);
      groupForm.resetFields();
      setGroupEmpOptions([]);
      loadGroups();
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to create WFH group");
    }
  };

  const startGroupEdit = (record) => {
    setEditingGroup(record);
    groupEditForm.setFieldsValue({
      name: record.name,
      range: [dayjs(record.startDate), dayjs(record.endDate)],
      members: (record.members || []).map((m) => m.empId),
      notes: record.notes || "",
      active: record.active !== false,
    });
    // Pre-populate employee options so tags show labels
    setGroupEmpOptions(
      (record.members || []).map((m) => ({
        value: m.empId,
        label: `${m.empId} — ${m.employeeName}`,
        empName: m.employeeName,
      }))
    );
    setGroupEditOpen(true);
  };

  const submitGroupEdit = async () => {
    try {
      const values = await groupEditForm.validateFields();
      const members = (values.members || []).map((m) => {
        const opt = groupEmpOptions.find((o) => o.value === m);
        return { empId: m, employeeName: opt?.empName || m };
      });
      const payload = {
        name: values.name || "",
        startDate: values.range[0],
        endDate: values.range[1],
        members,
        notes: values.notes || "",
        active: values.active,
      };
      await axiosInstance.put(`/wfh-groups/${editingGroup.key}`, payload);
      swalSuccess("WFH Group updated");
      setGroupEditOpen(false);
      setEditingGroup(null);
      setGroupEmpOptions([]);
      loadGroups();
    } catch (e) {
      swalError(e?.response?.data?.message || "Update failed");
    }
  };

  const removeGroup = async (record) => {
    try {
      await axiosInstance.delete(`/wfh-groups/${record.key}`);
      swalSuccess("WFH Group deleted");
      loadGroups();
    } catch (e) {
      swalError(e?.response?.data?.message || "Delete failed");
    }
  };

  /* ── Group form fields (shared between add / edit) ── */
  const renderGroupFormFields = (formInstance, isEdit = false) => (
    <>
      <Form.Item label="Group Name" name="name">
        <Input placeholder='e.g. "Field Staff – Week 1"' />
      </Form.Item>
      <Form.Item
        label="Date Range"
        name="range"
        rules={[{ required: true, message: "Date range is required" }]}
      >
        <RangePicker style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item
        label="Members"
        name="members"
        rules={[{ required: true, message: "Add at least 1 member" }]}
      >
        <Select
          mode="multiple"
          placeholder="Search employees…"
          filterOption={false}
          onSearch={handleGroupEmpSearch}
          notFoundContent={groupEmpSearching ? "Searching…" : "Type to search"}
          options={groupEmpOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item label="Notes" name="notes">
        <Input.TextArea rows={2} placeholder="Remarks (optional)" />
      </Form.Item>
      {isEdit && (
        <Form.Item label="Active" name="active" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
      )}
    </>
  );

  const groupColumns = [
    {
      title: "Group",
      dataIndex: "name",
      width: isMobile ? 100 : 160,
      render: (v) => v || "(unnamed)",
    },
    {
      title: "Date Range",
      key: "dates",
      width: isMobile ? 130 : 180,
      render: (_, r) =>
        `${dayjs(r.startDate).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format("YYYY-MM-DD")}`,
    },
    {
      title: "Members",
      key: "members",
      width: isMobile ? 80 : 200,
      render: (_, r) => {
        const m = r.members || [];
        if (isMobile) return m.length;
        return m
          .slice(0, 3)
          .map((x) => x.employeeName || x.empId)
          .join(", ") + (m.length > 3 ? ` (+${m.length - 3} more)` : "");
      },
    },
    ...(!isMobile
      ? [
          {
            title: "Active",
            dataIndex: "active",
            width: 70,
            render: (v) => (v === false ? "No" : "Yes"),
          },
        ]
      : []),
    {
      title: "Action",
      key: "action",
      width: isMobile ? 90 : 120,
      render: (_, r) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => startGroupEdit(r)}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => removeGroup(r)}
          />
        </Space>
      ),
    },
  ];

  /* ── Shared form fields ── */
  const renderFormFields = (formInstance, attachment, isEdit = false) => (
    <>
      <Form.Item label="Employee ID" name="empId">
        <AutoComplete
          options={empOptions}
          onSearch={handleEmpSearch}
          onSelect={(val, option) => handleEmpSelect(val, option, formInstance)}
          placeholder="Search by ID or name (e.g. 03-0946 or Juan)"
          allowClear
          notFoundContent={empSearching ? "Searching…" : undefined}
          filterOption={false}
        />
      </Form.Item>
      <Form.Item label="Employee Name" name="employeeName">
        <AutoComplete
          options={empOptions}
          onSearch={handleEmpSearch}
          onSelect={(val, option) => handleEmpSelect(val, option, formInstance)}
          placeholder="Search by name or ID"
          allowClear
          notFoundContent={empSearching ? "Searching…" : undefined}
          filterOption={false}
        />
      </Form.Item>
      <Form.Item label="Date Range" name="range" tooltip="Select range for multi-day WFH">
        <RangePicker style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item label="Or Single Date" name="date">
        <DatePicker style={{ width: "100%" }} />
      </Form.Item>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Form.Item label="Time In" name="timeIn" style={{ flex: 1, minWidth: 120 }}>
          <TimePicker format={timeFormat} use12Hours style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Break Out" name="breakOut" style={{ flex: 1, minWidth: 120 }}>
          <TimePicker format={timeFormat} use12Hours style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Break In" name="breakIn" style={{ flex: 1, minWidth: 120 }}>
          <TimePicker format={timeFormat} use12Hours style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Time Out" name="timeOut" style={{ flex: 1, minWidth: 120 }}>
          <TimePicker format={timeFormat} use12Hours style={{ width: "100%" }} />
        </Form.Item>
      </div>

      <Form.Item label="Notes" name="notes">
        <Input.TextArea rows={2} placeholder="Reason / remarks" />
      </Form.Item>

      {/* Attachment */}
      <Form.Item label="Attachment (Upload to Google Drive)">
        <Upload
          beforeUpload={(file) => handleUploadFile(file, isEdit)}
          showUploadList={false}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        >
          <Button icon={<UploadOutlined />} loading={uploading} size="small">
            {attachment ? "Replace File" : "Upload File"}
          </Button>
        </Upload>
        {attachment && (
          <div style={{ marginTop: 4 }}>
            <Tag color="blue" icon={<LinkOutlined />}>
              <a href={attachment.attachmentUrl} target="_blank" rel="noopener noreferrer">
                {attachment.attachmentName}
              </a>
            </Tag>
          </div>
        )}
      </Form.Item>

      {isEdit && (
        <Form.Item label="Active" name="active" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
      )}
    </>
  );

  return (
    <div>
      <Title level={4} style={{ marginBottom: 8 }}>
        Work From Home
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12, fontSize: isMobile ? 12 : 14 }}>
        Manage Work From Home entries. Each WFH record prescribes the office-hour
        times for the day(s) and can include a supporting attachment uploaded to
        Google Drive. These entries are reflected in the DTR Work Calendar.
      </Paragraph>

      <Space style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <Button type="primary" size={isMobile ? "small" : "middle"} onClick={() => setOpen(true)}>
          Add WFH Record
        </Button>
        <Button
          size={isMobile ? "small" : "middle"}
          icon={<TeamOutlined />}
          onClick={() => setGroupModalOpen(true)}
        >
          WFH Group
        </Button>
      </Space>

      <div style={{ overflowX: "auto" }}>
        <Table
          className="compact-table"
          size="small"
          dataSource={list}
          rowKey="key"
          scroll={{ x: isMobile ? 600 : 900 }}
          columns={[
            {
              title: "Employee",
              key: "emp",
              width: isMobile ? 100 : 140,
              render: (_, r) => r.employeeName || r.empId || "All",
            },
            {
              title: "Date",
              dataIndex: "date",
              width: isMobile ? 120 : 160,
              render: (d, r) =>
                r.endDate
                  ? `${dayjs(d).format("YYYY-MM-DD")} → ${dayjs(r.endDate).format("YYYY-MM-DD")}`
                  : dayjs(d).format("YYYY-MM-DD"),
            },
            ...(!isMobile
              ? [
                  { title: "Time In", dataIndex: "timeIn", width: 90 },
                  { title: "Break Out", dataIndex: "breakOut", width: 90 },
                  { title: "Break In", dataIndex: "breakIn", width: 90 },
                  { title: "Time Out", dataIndex: "timeOut", width: 90 },
                ]
              : []),
            ...(!isMobile
              ? [
                  {
                    title: "Attachment",
                    key: "attachment",
                    width: 120,
                    render: (_, r) =>
                      r.attachmentUrl ? (
                        <Tooltip title={r.attachmentName}>
                          <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer">
                            <LinkOutlined /> View
                          </a>
                        </Tooltip>
                      ) : (
                        "—"
                      ),
                  },
                ]
              : []),
            ...(!isMobile ? [{ title: "Notes", dataIndex: "notes", ellipsis: true }] : []),
            {
              title: "Active",
              dataIndex: "active",
              width: 70,
              render: (v) => (v === false ? "No" : "Yes"),
            },
            {
              title: "Action",
              key: "action",
              width: isMobile ? 120 : 140,
              render: (_, r) => {
                const deleteDisabled =
                  isDemoActive && isDemoUser && !demoNewIds.includes(r.key);
                return (
                  <Space size={isMobile ? 4 : 8}>
                    <Button size="small" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      danger
                      size="small"
                      disabled={deleteDisabled}
                      onClick={() => removeRecord(r)}
                    >
                      Del
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />
      </div>

      {/* Add Modal */}
      <Modal
        open={open}
        onCancel={() => {
          setOpen(false);
          setAttachmentData(null);
          form.resetFields();
        }}
        onOk={onSubmit}
        title="Add Work From Home Record"
        width={600}
      >
        <Form layout="vertical" form={form}>
          {renderFormFields(form, attachmentData, false)}
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
          setEditAttachmentData(null);
        }}
        onOk={submitEdit}
        title="Edit Work From Home Record"
        width={600}
      >
        <Form layout="vertical" form={editForm}>
          {renderFormFields(editForm, editAttachmentData, true)}
        </Form>
      </Modal>

      {/* ── WFH Group Modal (list) ── */}
      <Modal
        open={groupModalOpen}
        onCancel={() => setGroupModalOpen(false)}
        title="Work From Home Groups"
        width={isMobile ? "95vw" : 800}
        footer={[
          <Button key="close" onClick={() => setGroupModalOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Assign employees to WFH groups by date range. Members in an active group
          will show <strong>"WFH (see attch.)"</strong> on their DTR for the
          covered dates — time records are filled in by the employees themselves.
        </Paragraph>
        <Button
          type="primary"
          icon={<TeamOutlined />}
          size="small"
          style={{ marginBottom: 12 }}
          onClick={() => {
            setGroupAddOpen(true);
            groupForm.resetFields();
            setGroupEmpOptions([]);
          }}
        >
          Add Group
        </Button>
        <Table
          className="compact-table"
          size="small"
          dataSource={wfhGroups}
          rowKey="key"
          scroll={{ x: isMobile ? 400 : 700 }}
          columns={groupColumns}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ paddingLeft: 12 }}>
                <strong>Members:</strong>
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {(record.members || []).map((m, i) => (
                    <li key={i}>
                      {m.empId} — {m.employeeName}
                    </li>
                  ))}
                </ul>
                {record.notes && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Notes:</strong> {record.notes}
                  </div>
                )}
              </div>
            ),
          }}
          pagination={{ pageSize: 10 }}
        />
      </Modal>

      {/* ── Add WFH Group Modal ── */}
      <Modal
        open={groupAddOpen}
        onCancel={() => {
          setGroupAddOpen(false);
          groupForm.resetFields();
          setGroupEmpOptions([]);
        }}
        onOk={submitGroup}
        title="Add WFH Group"
        width={550}
      >
        <Form layout="vertical" form={groupForm}>
          {renderGroupFormFields(groupForm, false)}
        </Form>
      </Modal>

      {/* ── Edit WFH Group Modal ── */}
      <Modal
        open={groupEditOpen}
        onCancel={() => {
          setGroupEditOpen(false);
          setEditingGroup(null);
          setGroupEmpOptions([]);
        }}
        onOk={submitGroupEdit}
        title="Edit WFH Group"
        width={550}
      >
        <Form layout="vertical" form={groupEditForm}>
          {renderGroupFormFields(groupEditForm, true)}
        </Form>
      </Modal>
    </div>
  );
};

const Holidays = () => {
  return (
    <div>
      <Title level={3}>Holidays, Suspensions & WFH</Title>
      <Paragraph type="secondary">
        Configure national/local holidays, suspension days, and work-from-home
        entries which affect timekeeping and payroll calculations.
      </Paragraph>
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: "National Holidays",
            children: <NationalHolidays />,
          },
          { key: "2", label: "Local Holidays", children: <LocalHolidays /> },
          { key: "3", label: "Suspension Days", children: <Suspensions /> },
          { key: "4", label: "Work From Home", children: <WorkFromHome /> },
        ]}
      />
    </div>
  );
};

export default Holidays;
