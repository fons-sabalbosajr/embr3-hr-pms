import React from "react";
import { Table, Space, Button, Dropdown } from "antd";
import { EyeOutlined, PrinterOutlined } from "@ant-design/icons";

const DTRTable = ({
  columns,
  dataSource,
  loading,
  hasAnyDTRLogs,
  dtrDays,
  dtrLogs,
  selectedRecord,
  handleViewDTR,
  handlePrintSelected,
  handleAddToPrinterTray,
  rowSelection, // <-- new
}) => {
  const printMenu = (employee) => (
    <Menu>
      <Menu.Item
        key="addToTray"
        onClick={() => handleAddToPrinterTray(employee)}
      >
        Add to Printer Tray
      </Menu.Item>
    </Menu>
  );

  return (
    <Table
      rowKey={(record) => record.stableKey || record._id || record.empId || record.empNo || record.name}
      rowSelection={rowSelection} // <-- new
      columns={columns}
      dataSource={dataSource}
      bordered
      pagination={{ pageSize: 10 }}
      className="custom-small-table"
      scroll={{ x: 1000 }}
      rowClassName={(record) =>
        !hasAnyDTRLogs(record, dtrDays, dtrLogs, selectedRecord)
          ? "missing-dtr-row"
          : ""
      }
      loading={loading}
    />
  );
};

export default DTRTable;
