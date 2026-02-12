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
}) => {
  const [viewLoadingKey, setViewLoadingKey] = React.useState(null);
  const [downloadLoadingKey, setDownloadLoadingKey] = React.useState(null);
  const [downloadAllLoading, setDownloadAllLoading] = React.useState(false);
  const [clearTrayLoading, setClearTrayLoading] = React.useState(false);

  const makeKey = (item) =>
    `${item?.employee?.empId || ""}__${item?.selectedRecord?.DTR_Record_Name || ""}`;

  const runWithKey = async (setter, key, fn) => {
    setter(key);
    try {
      await Promise.resolve(fn());
    } finally {
      setter(null);
    }
  };

  const runWithFlag = async (setter, fn) => {
    setter(true);
    try {
      await Promise.resolve(fn());
    } finally {
      setter(false);
    }
  };

  const anyBusy =
    Boolean(viewLoadingKey) ||
    Boolean(downloadLoadingKey) ||
    downloadAllLoading ||
    clearTrayLoading;

  return (
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
          {printerTray.map((item) => {
            const key = makeKey(item);
            const isViewing = viewLoadingKey === key;
            const isDownloading = downloadLoadingKey === key;

            return (
              <div
                key={key}
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
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    size="small"
                    loading={isViewing}
                    disabled={anyBusy && !isViewing}
                    onClick={() =>
                      runWithKey(setViewLoadingKey, key, () =>
                        handlePreviewForm48(item.employee, item.selectedRecord)
                      )
                    }
                  >
                    View
                  </Button>

                  <Button
                    size="small"
                    loading={isDownloading}
                    disabled={anyBusy && !isDownloading}
                    onClick={() =>
                      runWithKey(setDownloadLoadingKey, key, () =>
                        handleDownloadDTR(item)
                      )
                    }
                  >
                    Download
                  </Button>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button
              type="primary"
              loading={downloadAllLoading}
              disabled={anyBusy && !downloadAllLoading}
              onClick={() => runWithFlag(setDownloadAllLoading, handleDownloadAllDTRs)}
            >
              Download All
            </Button>
            <Button
              danger
              loading={clearTrayLoading}
              disabled={anyBusy && !clearTrayLoading}
              onClick={() => runWithFlag(setClearTrayLoading, handleClearPrinterTray)}
            >
              Clear Tray
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
};

export default PrinterTrayDrawer;
