import React, { useState, useEffect, useMemo, useRef } from "react";
import { Table, Input, Select, DatePicker, Space, Button, Tag, Modal, Form, Grid } from "antd";
import { swalSuccess, swalError, swalConfirm } from "../../../../utils/swalHelper";
import useDemoMode from "../../../../hooks/useDemoMode";
import dayjs from "dayjs";
import { getEmployeeDocs, updateEmployeeDoc, deleteEmployeeDoc } from "../../../../api/employeeAPI"; // Adjust path as needed
import { getAllUsers } from "../../../../api/authAPI"; // Import getAllUsers
import socket from "../../../../../utils/socket";
import useAuth from "../../../../hooks/useAuth";

const { RangePicker } = DatePicker;
const { Option } = Select;

const SystemReport = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]); // State to store users
  const [loading, setLoading] = useState(false);
  const { shouldHideInDemo } = useDemoMode();
  const { user } = useAuth();
  const isDevUser = Boolean(user?.userType === 'developer' || user?.canAccessDeveloper || user?.canSeeDev);
  const [filters, setFilters] = useState({
    docType: "",
    createdBy: "",
    dateRange: [],
    empId: "",
    employeeName: "",
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      try {
        socket.off('employeeDoc:created');
        socket.off('employeeDoc:deleted');
        socket.off('employeeDoc:updated');
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filters, users]); // Re-fetch reports when filters or users change

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const usersResponse = await getAllUsers();
      setUsers(usersResponse.data.data);
      // Ensure socket connection
      try {
        if (!socket.connected) socket.connect();
      } catch (_) {}
      // Subscribe to new employee doc events to auto-refresh
      socket.off('employeeDoc:created');
      socket.on('employeeDoc:created', (doc) => {
        // Only react to relevant types if desired
        if (!doc || !doc.docType) return;
        // If filters exclude this doc, skip; else refetch
        const typeOk = !filters.docType || filters.docType === doc.docType;
        if (typeOk) {
          // Small debounce to allow backend to finalize relations
          setTimeout(() => fetchReports(), 200);
        }
      });
      socket.off('employeeDoc:deleted');
      socket.on('employeeDoc:deleted', () => {
        setTimeout(() => fetchReports(), 200);
      });
      socket.off('employeeDoc:updated');
      socket.on('employeeDoc:updated', () => {
        setTimeout(() => fetchReports(), 200);
      });
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const parsePeriodToRange = (period) => {
    try {
      if (!period) return [];
      const parts = String(period).split(' - ');
      if (parts.length === 2) {
        const start = dayjs(parts[0].trim());
        const end = dayjs(parts[1].trim());
        if (start.isValid() && end.isValid()) return [start, end];
      }
      // Try generic single date
      const d = dayjs(period);
      if (d.isValid()) return [d, d];
      return [];
    } catch {
      return [];
    }
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setEditModalOpen(true);
  };

  const setFormFromRecord = (rec) => {
    if (!rec) return;
    const values = {
      description: rec.description || '',
      dateIssued: rec.dateIssued ? dayjs(rec.dateIssued) : null,
      periodRange: parsePeriodToRange(rec.period),
      docNo: rec.docNo,
    };
    try {
      form.setFieldsValue(values);
    } catch (_) {}
  };

  useEffect(() => {
    if (editModalOpen && editingRecord) {
      // Defer set to ensure form is mounted
      const t = setTimeout(() => setFormFromRecord(editingRecord), 0);
      return () => clearTimeout(t);
    } else {
      form.resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editModalOpen, editingRecord]);

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      const payload = {};
      if (values.description !== undefined) payload.description = values.description;
      if (values.dateIssued) payload.dateIssued = values.dateIssued.toDate();
      if (values.periodRange && values.periodRange.length === 2) {
        const [s, e] = values.periodRange;
        payload.period = `${s.format('YYYY-MM-DD')} - ${e.format('YYYY-MM-DD')}`;
      }
      if (values.docNo !== undefined && values.docNo !== editingRecord.docNo) payload.docNo = values.docNo;
      setLoading(true);
      await updateEmployeeDoc(editingRecord._id, payload);
      swalSuccess('Report updated');
      setEditModalOpen(false);
      setEditingRecord(null);
      await fetchReports();
    } catch (e) {
      if (e?.errorFields) return; // form validation errors
      console.error(e);
      swalError(e?.response?.data?.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      setLoading(true);
      await deleteEmployeeDoc(record._id);
      swalSuccess('Report deleted');
      await fetchReports();
    } catch (e) {
      console.error(e);
      swalError(e?.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await getEmployeeDocs();
      let filteredReports = response.data.data;

      // Apply filters
      if (filters.docType) {
        filteredReports = filteredReports.filter(
          (report) => report.docType === filters.docType
        );
      }
      if (filters.createdBy) {
        filteredReports = filteredReports.filter((report) => {
          const user = users.find((u) => u.name === filters.createdBy);
          return user && report.createdBy === user.username;
        });
      }
      if (filters.empId) {
        filteredReports = filteredReports.filter((report) =>
          report.empId.toLowerCase().includes(filters.empId.toLowerCase())
        );
      }
      if (filters.employeeName) {
        filteredReports = filteredReports.filter(
          (report) =>
            report.employee &&
            report.employee.name
              .toLowerCase()
              .includes(filters.employeeName.toLowerCase())
        );
      }
      if (filters.dateRange && filters.dateRange.length === 2) {
        const [startDate, endDate] = filters.dateRange;
        filteredReports = filteredReports.filter((report) => {
          const reportDate = dayjs(report.dateIssued);
          return (
            reportDate.isAfter(startDate.startOf("day")) &&
            reportDate.isBefore(endDate.endOf("day"))
          );
        });
      }

      // Always sort newest to oldest by dateIssued
      filteredReports = (filteredReports || []).sort(
        (a, b) => dayjs(b.dateIssued).valueOf() - dayjs(a.dateIssued).valueOf()
      );

      setReports(filteredReports);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
  };

  // Use useMemo to memoize userMap and recompute only when 'users' changes
  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.username] = user.name;
      return acc;
    }, {});
  }, [users]);

  const columns = [
    {
      title: "Document Type",
      dataIndex: "docType",
      key: "docType",
      width: isMobile ? 100 : undefined,
      render: (docType) => <Tag color="blue">{docType}</Tag>,
      sorter: (a, b) => a.docType.localeCompare(b.docType),
    },
    {
      title: "Employee",
      key: "employeeInfo",
      width: isMobile ? 120 : undefined,
      render: (text, record) => (
        <>
          <div>{record.employee?.name || "N/A"}</div>
          <small style={{ color: "#999" }}>{record.empId}</small>
        </>
      ),
      sorter: (a, b) =>
        (a.employee?.name || "").localeCompare(b.employee?.name || ""),
    },
    ...(!isMobile
      ? [
          {
            title: "Description",
            dataIndex: "description",
            key: "description",
            render: (text) => <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>,
          },
        ]
      : []),
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      render: (period) => {
        if (!period) return "N/A";

        let dates = [];
        if (period.includes(" - ")) {
          dates = period.split(" - ");
        } else if (period.includes("-")) {
          dates = period.split("-");
        }

        if (dates.length === 2) {
          const startDate = dayjs(dates[0].trim());
          const endDate = dayjs(dates[1].trim());
          if (startDate.isValid() && endDate.isValid()) {
            return `${startDate.format("MM/DD/YYYY")} - ${endDate.format(
              "MM/DD/YYYY"
            )}`;
          }
        }

        const singleDate = dayjs(period);
        if (singleDate.isValid()) {
          return singleDate.format("MM/DD/YYYY");
        }

        return period; // Fallback to original period if parsing fails
      },
      sorter: (a, b) => (a.period || "").localeCompare(b.period || ""),
    },

    {
      title: "Issued By / Date",
      key: "issuedByDate",
      render: (text, record) => (
        <>
          <div>{userMap[record.createdBy] || record.createdBy}</div>
          <small style={{ color: "#999" }}>
            {dayjs(record.dateIssued).format("MM/DD/YYYY hh:mm A")}
          </small>
        </>
      ),
      sorter: (a, b) => dayjs(a.dateIssued).valueOf() - dayjs(b.dateIssued).valueOf(),
      defaultSortOrder: 'descend',
      sortDirections: ['descend', 'ascend'],
    },
    ...(isDevUser ? [{
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>Update</Button>
          <Button size="small" danger onClick={async () => { const r = await swalConfirm({ title: "Delete this report?", confirmText: "Delete", dangerMode: true }); if (r.isConfirmed) handleDelete(record); }}>Delete</Button>
        </Space>
      ),
    }] : []),
  ];

  const uniqueDocTypes = [...new Set(reports.map((report) => report.docType))];
  // Filter out undefined or null names before creating unique list for Select
  const uniqueCreatedByUsers = [
    ...new Set(users.map((user) => user.name).filter((name) => name)),
  ];

  return (
    <div style={{ padding: "10px" }} className="compact-table">
      {!shouldHideInDemo('ui.dtr.reports.generate') && (
        <h2 style={{ marginTop: 0, fontSize: 18 }}>System Generated Reports</h2>
      )}
      <Space style={{ marginBottom: 16, flexWrap: "wrap", width: '100%' }}>
        <Input
          placeholder="Search Employee ID"
          value={filters.empId}
          onChange={(e) => handleFilterChange("empId", e.target.value)}
          style={{ width: isMobile ? '100%' : 180 }}
        />
        <Input
          placeholder="Search Employee Name"
          value={filters.employeeName}
          onChange={(e) => handleFilterChange("employeeName", e.target.value)}
          style={{ width: isMobile ? '100%' : 180 }}
        />
        <Select
          placeholder="Select Document Type"
          style={{ width: isMobile ? '100%' : 180 }}
          onChange={(value) => handleFilterChange("docType", value)}
          value={filters.docType}
          allowClear
        >
          {uniqueDocTypes.map((type) => (
            <Option key={type} value={type}>
              {type}
            </Option>
          ))}
        </Select>

        <Button
          onClick={() =>
            setFilters({
              docType: "",
              createdBy: "",
              dateRange: [],
              empId: "",
              employeeName: "",
            })
          }
        >
          Clear Filters
        </Button>
      </Space>
      <Table
        className="compact-table"
        columns={columns}
        dataSource={reports}
        loading={loading}
        rowKey="_id"
        pagination={{
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
          defaultPageSize: 10,
        }}
        scroll={{ x: "max-content" }}
        size="small"
      />

      <Modal
        title="Update Report"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingRecord(null); }}
        onOk={handleUpdate}
        okText="Save"
        confirmLoading={loading}
        destroyOnClose
        afterOpenChange={(open) => { if (open && editingRecord) setFormFromRecord(editingRecord); }}
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Enter description" />
          </Form.Item>
          <Form.Item label="Period" name="periodRange">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item label="Date Issued" name="dateIssued">
            <DatePicker showTime />
          </Form.Item>
          <Form.Item label="Payslip No." name="docNo">
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemReport;
