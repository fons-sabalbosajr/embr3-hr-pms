// src/components/Settings/Backup/Tabs/DTRDataTab.jsx
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  message,
  Row,
  Col,
  Modal,
  Form,
  DatePicker,
  Card,
  Progress,
  Spin,
  Tooltip,
} from "antd";
import {
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
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
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(null);
  const deletePollRef = React.useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // when fetching
  const fetchData = async (range = dateRange) => {
    try {
      const params = {};
      if (Array.isArray(range) && range[0] && range[1]) {
        params.startDate = range[0].toISOString();
        params.endDate = range[1].toISOString();
      }
      const res = await axiosInstance.get("/dtrdatas", { params });
      const rows = res.data?.data ?? res.data ?? [];
      setData(rows);
    } catch (err) {
      message.error("Failed to load DTR data");
    }
  };

  // handle search across fetched (already date-filtered) data
  useEffect(() => {
    const lowered = (searchText || "").toLowerCase();
    const results = (data || []).filter((d) =>
      JSON.stringify(d || {})
        .toLowerCase()
        .includes(lowered)
    );
    setFiltered(results);
    setPage(1);
  }, [searchText, data]);

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      DTR_Record_Name: record.DTR_Record_Name,
      DTR_Cut_Off: [
        record?.DTR_Cut_Off?.start ? dayjs(record.DTR_Cut_Off.start) : null,
        record?.DTR_Cut_Off?.end ? dayjs(record.DTR_Cut_Off.end) : null,
      ],
    });
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        DTR_Record_Name: values.DTR_Record_Name,
        DTR_Cut_Off: {
          start: values.DTR_Cut_Off[0].toDate(),
          end: values.DTR_Cut_Off[1].toDate(),
        },
      };
      await axiosInstance.put(`/dtrdata/${editing._id}`, payload);
      message.success("Updated");
      setEditModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      message.error("Update failed");
    }
  };

  const handleDelete = async (id) => {
    // open preview modal and load sample
    const rec = data.find((r) => r._id === id) || null;
    if (!rec) return message.error("Record not found");
    setPreviewRecord(rec);
    setPreviewModalOpen(true);
    // fetch sample logs via merged endpoint (pageable)
    try {
      setPreviewLoading(true);
      const startDate = rec?.DTR_Cut_Off?.start
        ? dayjs(rec.DTR_Cut_Off.start).format()
        : undefined;
      const endDate = rec?.DTR_Cut_Off?.end
        ? dayjs(rec.DTR_Cut_Off.end).format()
        : undefined;
      const res = await axiosInstance.get("/dtrlogs/merged", {
        params: {
          recordName: rec.DTR_Record_Name,
          startDate,
          endDate,
          page: previewPage,
          limit: previewPageSize,
        },
      });
      if (res.data && res.data.success) {
        setPreviewSample(res.data.data || []);
        setPreviewTotal(
          typeof res.data.total === "number"
            ? res.data.total
            : (res.data.data || []).length
        );
      } else {
        setPreviewSample([]);
        setPreviewTotal(0);
      }
    } catch (e) {
      console.error("Preview load failed", e);
      message.error("Failed to load preview samples");
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
        setDeletingJobId(res.data.jobId);
        setDeleteProgress({ status: "queued", total: 0, deleted: 0 });
        // start polling
        deletePollRef.current = setInterval(async () => {
          try {
            const p = await axiosInstance.get(
              `/dtrdatas/delete-progress/${res.data.jobId}`
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
                  setDeletingJobId(null);
                }, 600);
                fetchData();
                if (p.data.data.status === "done")
                  message.success(`Deleted ${p.data.data.deleted} logs`);
                else
                  message.error(
                    `Delete failed: ${p.data.data.message || "error"}`
                  );
              }
            }
          } catch (err) {
            console.warn("Delete progress poll error", err);
          }
        }, 1000);
      } else {
        message.error("Failed to start delete job");
      }
    } catch (err) {
      console.error("Start delete failed", err);
      message.error("Failed to start delete");
    }
  };

  useEffect(() => {
    return () => {
      if (deletePollRef.current) clearInterval(deletePollRef.current);
    };
  }, []);

  const exportCsv = () => {
    if (!data?.length) return message.warning("No data to export");
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

  const columns = [
    { title: "Record Name", dataIndex: "DTR_Record_Name", key: "name" },
    {
      title: "Cut Off",
      key: "cutoff",
      render: (r) =>
        r?.DTR_Cut_Off
          ? `${dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD")} → ${dayjs(
              r.DTR_Cut_Off.end
            ).format("YYYY-MM-DD")}`
          : "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEdit(record)}
          >
            Edit
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDelete(record._id)}
          >
            Delete
          </Button>
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
                          (deleteProgress.deleted / deleteProgress.total) * 100
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
              pagination={{
                current: previewPage,
                pageSize: previewPageSize,
                total: previewTotal,
                onChange: async (p, ps) => {
                  setPreviewPage(p);
                  setPreviewPageSize(ps);
                  // refetch sample for new page/size
                  if (previewRecord) {
                    try {
                      setPreviewLoading(true);
                      const startDate = previewRecord?.DTR_Cut_Off?.start
                        ? dayjs(previewRecord.DTR_Cut_Off.start).format()
                        : undefined;
                      const endDate = previewRecord?.DTR_Cut_Off?.end
                        ? dayjs(previewRecord.DTR_Cut_Off.end).format()
                        : undefined;
                      const res = await axiosInstance.get("/dtrlogs/merged", {
                        params: {
                          recordName: previewRecord.DTR_Record_Name,
                          startDate,
                          endDate,
                          page: p,
                          limit: ps,
                        },
                      });
                      if (res.data && res.data.success) {
                        setPreviewSample(res.data.data || []);
                        setPreviewTotal(
                          typeof res.data.total === "number"
                            ? res.data.total
                            : (res.data.data || []).length
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
                      String(emp).replace(/\D/g, "")
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
        title="Edit DTR Data"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={saveEdit}
        okText="Save"
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
        </Form>
      </Modal>
    </Card>
  );
};

export default DTRDataTab;
