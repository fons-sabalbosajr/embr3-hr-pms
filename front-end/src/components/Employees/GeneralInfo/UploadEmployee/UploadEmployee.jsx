import React, { useState } from "react";
import {
  Upload,
  Button,
  Typography,
  Space,
  Table,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import axios from "axios";
import "./uploademployee.css";
import Swal from "sweetalert2";
import { swalError, swalWarning } from "../../../../utils/swalHelper";

const { Dragger } = Upload;
const { Text } = Typography;

const UploadEmployee = ({ onClose }) => {
  const [parsedData, setParsedData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [fileList, setFileList] = useState([]);

  const parseCSV = (fileContent) => {
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length) {
      swalError("CSV parse error.");
      return;
    }

    const data = parsed.data;
    setParsedData(data);
    setColumns(generateColumns(data));
  };

  const parseExcel = (binary) => {
    const workbook = XLSX.read(binary, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData.length) {
      swalError("Excel file is empty.");
      return;
    }

    setParsedData(jsonData);
    setColumns(generateColumns(jsonData));
  };

  const handleFileChange = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target.result;

      const processData = (parsedData) => {
        const empIdCount = {};
        const cleanedData = parsedData.map((row) => {
          const empId = row.Emp_ID?.toString().trim();
          empIdCount[empId] = (empIdCount[empId] || 0) + 1;
          return row;
        });

        const finalData = cleanedData.map((row) => ({
          ...row,
          isDuplicate: empIdCount[row.Emp_ID?.toString().trim()] > 1,
        }));

        setParsedData(finalData);
      };

      if (file.name.endsWith(".csv")) {
        parseCSV(data, processData);
      } else {
        parseExcel(data, processData);
      }
    };

    // File validations
    const allowedExtensions = [".csv", ".xlsx", ".xls"];
    const fileExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      swalError("Unsupported file format.");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      swalError("File exceeds 5MB limit.");
      return false;
    }

    if (fileExt === ".csv") {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }

    setFileList([file]);
    return false; // Prevent default upload
  };

  const generateColumns = (data) => {
    return Object.keys(data[0]).map((key) => ({
      title: key,
      dataIndex: key,
      key: key,
    }));
  };

  const handleSubmit = async () => {
    if (!parsedData.length) {
      return swalWarning("No data to submit.");
    }

    const confirm = await Swal.fire({
      title: "Confirm Upload",
      text: `Are you sure you want to add ${parsedData.length} employees to the list?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, submit",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      Swal.fire({
        title: "Uploading...",
        text: "Please wait while we submit the data.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await axios.post(
        "/api/employees/upload-employees",
        {
          employees: parsedData,
        },
        {
          headers: {
            "x-uploaded-by": "Admin User", // Update if dynamic
          },
        }
      );

      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "Employees uploaded successfully.",
      });

      // Reset UI
      setParsedData([]);
      setColumns([]);
      setFileList([]);

      if (onClose) onClose();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: "There was a problem uploading the data.",
      });
    }
  };

  const hasDuplicates = parsedData.some((row) => row.isDuplicate);

  return (
    <div className="upload-employee-container">
      <Space direction="vertical" style={{ width: "100%" }}>
        {fileList.length === 0 && (
          <Dragger
            accept=".csv,.xlsx,.xls"
            fileList={fileList}
            beforeUpload={handleFileChange}
            onRemove={() => {
              setParsedData([]);
              setColumns([]);
              setFileList([]);
            }}
            multiple={false}
            className="upload-dragger"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint">
              Supports CSV or Excel. Max file size: 5MB.
            </p>
          </Dragger>
        )}

        {parsedData.length > 0 && (
          <Table
            dataSource={parsedData}
            columns={columns}
            rowKey={(record) => record.Emp_ID}
            pagination={{
              pageSize: 5,
              size: "small", // smaller pagination UI
              showSizeChanger: false,
            }}
            bordered
            scroll={{
              y: 300, // vertical scroll height (adjustable)
            }}
            rowClassName={(record) =>
              record.isDuplicate ? "duplicate-row" : ""
            }
          />
        )}

        {/* === BUTTON GROUP === */}
        <Space direction="horizontal">
          <Tooltip title="Download Template">
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => window.open("/employee-template.xlsx", "_blank")}
              disabled={fileList.length === 0}
            />
          </Tooltip>

          {parsedData.length > 0 && (
            <Tooltip title="Submit to Database">
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={handleSubmit}
                disabled={hasDuplicates}
              >
                Add List
              </Button>
            </Tooltip>
          )}

          {fileList.length > 0 && (
            <Tooltip title="Replace Uploaded File">
              <Button
                danger
                icon={<ReloadOutlined />}
                onClick={() => {
                  setParsedData([]);
                  setColumns([]);
                  setFileList([]);
                }}
              />
            </Tooltip>
          )}
        </Space>

        <Text type="secondary">
          Ensure your file includes headers like:
          <strong>
            {" "}
            No., Emp_ID, Emp_Type, Name, Position, Section/Unit, Division
          </strong>
        </Text>
      </Space>
    </div>
  );
};

export default UploadEmployee;
