import React from "react";
import { Drawer, Button } from "antd";

const PrinterTrayDrawer = ({
  visible,
  onClose,
  printerTray,
  handleViewDTR,
  handlePrintSelected,
  handleDownloadDTR,
  handleDownloadAllDTRs,
  handleClearPrinterTray,
  handlePreviewForm48, // <-- new
}) => (
  <Drawer
    title="Print Daily Time Records"
    placement="right"
    width={350}
    onClose={onClose}
    open={visible}
    getContainer={document.body} 
    style={{
      boxShadow: "-3px 0 10px 3px rgba(0, 0, 0, 0.12)",
      borderRadius: "12px",
      zIndex: 1000,
    }}
  >
    {printerTray.length === 0 ? (
      <p>No DTRs added to tray.</p>
    ) : (
      <>
        {printerTray.map((item) => (
          <div
            key={item.employee.empId + item.selectedRecord.DTR_Record_Name}
            style={{
              marginBottom: 16,
              borderBottom: "1px solid #eee",
              paddingBottom: 8,
            }}
          >
            <strong>{item.employee.name}</strong>
            <div style={{ fontSize: 12, color: "#888" }}>
              {item.employee.empNo} | {item.employee.empType}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="small" onClick={() => handlePreviewForm48(item.employee, item.selectedRecord)}>
                View
              </Button>

              <Button size="small" onClick={() => handleDownloadDTR(item)}>
                Download
              </Button>

            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Button type="primary" onClick={handleDownloadAllDTRs}>
            Download All
          </Button>
          <Button danger onClick={handleClearPrinterTray}>
            Clear Tray
          </Button>
        </div>
      </>
    )}
  </Drawer>
);

export default PrinterTrayDrawer;
