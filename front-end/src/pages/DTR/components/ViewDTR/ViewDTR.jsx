import React from "react";
import { Modal, Table, Typography, Divider } from "antd";
import dayjs from "dayjs";
import "./viewdtr.css";

const { Text } = Typography;

const ViewDTR = ({
  visible,
  onClose,
  employee,
  dtrDays,
  dtrLogs,
  selectedRecord,
}) => {
  if (!employee || !selectedRecord) return null;

  const startDate = dayjs(selectedRecord.DTR_Cut_Off.start);
  const endDate = dayjs(selectedRecord.DTR_Cut_Off.end);
  const dateRangeStr = `${startDate.format("MMMM D, YYYY")} - ${endDate.format(
    "MMMM D, YYYY"
  )}`;

  const tableData = dtrDays.map((dayNum) => {
    const dateObj = startDate.date(dayNum);
    const dayOfWeek = dateObj.day(); // 0=Sun, 6=Sat

    const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(
      Boolean
    );

    const getDayLog = (dObj) => {
      const dateKey = dObj.format("YYYY-MM-DD");
      for (let id of ids) {
        const empKey = id.replace(/\D/g, "").slice(-4);
        if (dtrLogs[empKey] && dtrLogs[empKey][dateKey]) {
          return dtrLogs[empKey][dateKey];
        }
      }
      return null;
    };

    const dayLog = getDayLog(dateObj);
    const hasTimeInOut = dayLog?.["Time In"] && dayLog?.["Time Out"];

    // For weekend, we merge all Time / Break / Status cells into one
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      return {
        key: dayNum,
        date: dateObj.format("MM/DD/YYYY"),
        weekendLabel: dayOfWeek === 6 ? "Saturday" : "Sunday",
        isWeekend: true,
        timeIn: "", // will be merged
        breakOut: "",
        breakIn: "",
        timeOut: "",
        status: "",
      };
    }

    return {
      key: dayNum,
      date: dateObj.format("MM/DD/YYYY"),
      timeIn: dayLog?.["Time In"] || "",
      breakOut: hasTimeInOut ? dayLog?.["Break Out"] || "12:00 PM" : "",
      breakIn: hasTimeInOut ? dayLog?.["Break In"] || "1:00 PM" : "",
      timeOut: dayLog?.["Time Out"] || "",
      status: "", // you can compute dynamically
      isWeekend: false,
    };
  });

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
    },
    {
      title: "AM",
      children: [
        {
          title: "Time In",
          dataIndex: "timeIn",
          key: "timeIn",
          width: 100,
          render: (text, record) =>
            record.isWeekend
              ? {
                  children: record.weekendLabel,
                  props: {
                    colSpan: 5,
                    style: { textAlign: "center", backgroundColor: "#f5f5f5" },
                  },
                }
              : text,
        },
        {
          title: "Break Out",
          dataIndex: "breakOut",
          key: "breakOut",
          width: 100,
          render: (_, record) =>
            record.isWeekend
              ? { children: null, props: { colSpan: 0 } }
              : record.breakOut,
        },
      ],
    },
    {
      title: "PM",
      children: [
        {
          title: "Break In",
          dataIndex: "breakIn",
          key: "breakIn",
          width: 100,
          render: (_, record) =>
            record.isWeekend
              ? { children: null, props: { colSpan: 0 } }
              : record.breakIn,
        },
        {
          title: "Time Out",
          dataIndex: "timeOut",
          key: "timeOut",
          width: 100,
          render: (_, record) =>
            record.isWeekend
              ? { children: null, props: { colSpan: 0 } }
              : record.timeOut,
        },
      ],
    },
    {
      title: "Work",
      children: [
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: 120,
          render: (_, record) =>
            record.isWeekend
              ? { children: null, props: { colSpan: 0 } }
              : record.status,
        },
      ],
    },
  ];

  return (
    <Modal
      title={null}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={750}
    >
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* First line: Full Name left, Emp. ID right */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text strong>DTR Full Name: {employee.name}</Text>
          <Text style={{ textAlign: "left", marginRight: 30 }}>
            Employee ID: {employee.empId}
          </Text>
        </div>

        {/* Second line: Employee No. left, Employee Type right */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text>Employee No.: {employee.empNo}</Text>
          <Text style={{ textAlign: "left", marginRight: 30 }}>
            Employee Type: {employee.empType}
          </Text>
        </div>

        {/* Third line: Division / Section */}
        <div>
          <Text>
            Division / Section: {employee.division}{" "}
            {employee.sectionOrUnit && `| ${employee.sectionOrUnit}`}
          </Text>
        </div>

        {/* Fourth line: DTR Date Range */}
        <div>
          <Text underline>DTR Date Range: {dateRangeStr}</Text>
        </div>
      </div>

      <Divider />

      <Table
        dataSource={tableData}
        columns={columns}
        pagination={false}
        bordered
        size="small"
        scroll={{ x: 650 }}
        rowClassName={(record) => (record.isWeekend ? "weekend-row" : "")}
      />
    </Modal>
  );
};

export default ViewDTR;
