import React, { useEffect, useState } from "react";
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
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
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

const Holidays = () => {
  return (
    <div>
      <Title level={3}>Holidays & Suspensions</Title>
      <Paragraph type="secondary">
        Configure national/local holidays and suspension days which affect
        timekeeping and payroll calculations.
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
        ]}
      />
    </div>
  );
};

export default Holidays;
