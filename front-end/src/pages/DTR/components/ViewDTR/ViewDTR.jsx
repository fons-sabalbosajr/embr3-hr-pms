import React from "react";
import { Modal, Table, Typography, Divider, Button, message } from "antd";
import dayjs from "dayjs";
import "./viewdtr.css";
import { generateDTRPdf } from "../../../../../utils/generateDTRpdf";

const { Text } = Typography;

const ViewDTR = ({
  visible,
  onClose,
  employee,
  dtrDays, // kept in props, but we don’t use it anymore
  dtrLogs,
  selectedRecord,
  onPreviewForm48,
  onSaveToTray,
}) => {
  if (!employee || !selectedRecord) return null;

  const startDate = dayjs(selectedRecord.DTR_Cut_Off.start);
  const endDate = dayjs(selectedRecord.DTR_Cut_Off.end);
  const dateRangeStr = `${startDate.format("MMMM D, YYYY")} - ${endDate.format(
    "MMMM D, YYYY"
  )}`;

  // ✅ Build rows for ALL days in cutoff range
  const tableData = [];
  let current = startDate.clone();

  while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
    const dayOfWeek = current.day(); // 0=Sun, 6=Sat

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

    const dayLog = getDayLog(current);

    tableData.push({
      key: current.format("YYYY-MM-DD"),
      date: current.format("MM/DD/YYYY"),
      timeIn: dayLog?.["Time In"] || "",
      breakOut: dayLog?.["Break Out"] || "",
      breakIn: dayLog?.["Break In"] || "",
      timeOut: dayLog?.["Time Out"] || "",
      status: "",
      // ✅ Only mark weekend if no logs found
      isWeekend: (dayOfWeek === 6 || dayOfWeek === 0) && !dayLog,
      weekendLabel: dayOfWeek === 6 ? "Saturday" : "Sunday",
    });

    current = current.add(1, "day");
  }

  // ✅ Columns: only merge if weekend AND no logs
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
          width: 80,
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
          width: 80,
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
          width: 80,
          render: (_, record) =>
            record.isWeekend
              ? { children: null, props: { colSpan: 0 } }
              : record.breakIn,
        },
        {
          title: "Time Out",
          dataIndex: "timeOut",
          key: "timeOut",
          width: 80,
          render: (_, record) =>
            record.isWeekend
              ? { children: null, props: { colSpan: 0 } }
              : record.timeOut,
        },
      ],
    },
    {
      title: "Work Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 120,
      render: (_, record) =>
        record.isWeekend
          ? { children: null, props: { colSpan: 0 } }
          : record.status,
    },
  ];

  const handlePreviewForm48 = () => {
    generateDTRPdf({ employee, dtrDays, dtrLogs, selectedRecord });
  };

  const handleSaveToTray = () => {
    if (onSaveToTray) {
      onSaveToTray(employee, selectedRecord);
      message.success("DTR has been added to the Printer Tray!");
    }
  };

  return (
    <Modal
      title={null}
      open={visible}
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
          <Text strong>Employee Name: {employee.name}</Text>
          <Text style={{ textAlign: "left", marginRight: 30 }}>
            Employee ID: <Text strong>{employee.empId}</Text>
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
          <Text underline>DTR Cut-Off Date: {dateRangeStr}</Text>
        </div>
      </div>

      <div
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}
      >
        <Button type="primary" onClick={handlePreviewForm48}>
          Preview DTR Form 48
        </Button>
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

      {/* Save to Print Tray Button */}
      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}
      >
        <Button type="default" onClick={handleSaveToTray}>
          Save to Print Tray
        </Button>
      </div>
    </Modal>
  );
};

export default ViewDTR;
