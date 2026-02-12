import React, { useState, useEffect, useMemo } from "react";
import useDemoMode from "../../../../hooks/useDemoMode";
import { secureSessionGet, secureSessionStore } from "../../../../../utils/secureStorage";
import { buildColorMapFromList, pickTagColor, TAG_COLOR_PALETTE } from "../../../../utils/tagColors";
import {
  Table,
  Card,
  message,
  Button,
  Popconfirm,
  Tag,
  Typography,
  Form,
  Tooltip,
  Grid,
} from "antd";
import {
  getEmployees,
  getSignatoryEmployees,
  updateEmployeeSignatory,
  getUniqueSectionOrUnits,
} from "../../../../api/employeeAPI";
import dayjs from "dayjs";
import {
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import SignatoryModal from "./components/SignatoryModal";
import "./signatory.css";

// Parse acronyms from environment variables
const VITE_DIVISION_ACRONYMS = JSON.parse(
  import.meta.env.VITE_DIVISION_ACRONYMS || "{}"
);
const VITE_SECTION_OR_UNIT_ACRONYMS = JSON.parse(
  import.meta.env.VITE_SECTION_OR_UNIT_ACRONYMS || "{}"
);
const VITE_POSITION_ACRONYMS = JSON.parse(
  import.meta.env.VITE_POSITION_ACRONYMS || "{}"
);

// Generic function to get acronym if not found in map
const getAcronymFromEnv = (fullName, mapping) => {
  if (mapping[fullName]) {
    return mapping[fullName];
  }
  // If not found in mapping, return the full name as is
  return fullName;
};

const { Text } = Typography;

const chiefs = {
  CPD: "03-016",
  FAD: "03-024",
  EMED: "03-673",
};

// Legacy explicit colors for role designations
const designationColors = {
  "Division Chief": "blue",
  "Section Chief": "green",
  "Unit Chief": "purple",
  OIC: "orange",
};

// Deterministic color assignment for divisions / sections / units so tags visually align app-wide.

const Signatory = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { readOnly, isDemoActive, isDemoUser } = useDemoMode();
  const DEMO_SESSION_KEY = "__demo_new_signatory__";
  const [demoNewSet, setDemoNewSet] = useState(() => {
    try {
      const arr = secureSessionGet(DEMO_SESSION_KEY) || [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  });
  const persistDemoNew = (next) => {
    try { secureSessionStore(DEMO_SESSION_KEY, Array.from(next)); } catch (_) {}
  };
  const markSessionNew = (id) => {
    if (!id) return;
    setDemoNewSet((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      persistDemoNew(next);
      return next;
    });
  };
  const isRecordSessionNew = (record) => {
    if (!isDemoActive || !record) return false;
    return record._id && demoNewSet.has(String(record._id));
  };
  const [signatories, setSignatories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSignatory, setEditingSignatory] = useState(null);
  const [form] = Form.useForm();
  const [sectionOrUnitOptions, setSectionOrUnitOptions] = useState([]);
  const [allRegularEmployees, setAllRegularEmployees] = useState([]); // Filtered employees

  useEffect(() => {
    fetchSectionOrUnitOptions();
    fetchAllRegularEmployees(); // Fetch and filter employees
    syncChiefsAsSignatories();
  }, []);

  const fetchAllRegularEmployees = async () => {
    try {
      const res = await getEmployees();
      const regularEmployees = res.data.filter(
        (emp) => emp.empType === "Regular"
      );
      setAllRegularEmployees(regularEmployees);
    } catch (error) {
      message.error("Failed to fetch regular employees.");
    }
  };

  const fetchSectionOrUnitOptions = async () => {
    try {
      const res = await getUniqueSectionOrUnits();
      // Sort options to put divisions at the top
      const sortedOptions = res.data.sort((a, b) => {
        const isADivision = a.includes("Division");
        const isBDivision = b.includes("Division");
        if (isADivision && !isBDivision) return -1;
        if (!isADivision && isBDivision) return 1;
        return a.localeCompare(b);
      });
      setSectionOrUnitOptions(sortedOptions);
    } catch (error) {
      message.error("Failed to fetch section/unit options.");
    }
  };

  const syncChiefsAsSignatories = async () => {
    try {
      setLoading(true);
      const [employeesRes, currentSignatoriesRes] = await Promise.all([
        getEmployees(),
        getSignatoryEmployees(),
      ]);
      const allEmployeesData = employeesRes.data;
      const currentSignatoryEmployees = currentSignatoriesRes.data;

      for (const division in chiefs) {
        const chiefEmpId = chiefs[division];
        const chiefEmployee = allEmployeesData.find(
          (e) => e.empId === chiefEmpId
        );

        if (chiefEmployee) {
          const isAlreadySignatory = currentSignatoryEmployees.some(
            (s) => s.empId === chiefEmpId
          );

          if (!isAlreadySignatory) {
            const payload = {
              isSignatory: true,
              isDefaultSignatory: true, // Default to default
              signatoryDesignation: [chiefEmployee.division], // Use actual division name
            };
            await updateEmployeeSignatory(chiefEmployee._id, payload);
          }
        }
      }
      fetchSignatories();
    } catch (error) {
      message.error("Failed to sync chiefs as signatories.");
      setLoading(false);
    }
  };

  const fetchSignatories = async () => {
    try {
      setLoading(true);
      const res = await getSignatoryEmployees();
      setSignatories(res.data);
    } catch (error) {
      message.error("Failed to fetch signatories.");
    } finally {
      setLoading(false);
    }
  };

  const showAddModal = () => {
    setEditingSignatory(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (record) => {
    setEditingSignatory(record);
    const alternateStartDate = record.alternateDateOfEffectivityStart
      ? dayjs(record.alternateDateOfEffectivityStart)
      : null;
    const alternateEndDate = record.alternateDateOfEffectivityEnd
      ? dayjs(record.alternateDateOfEffectivityEnd)
      : null;

    form.setFieldsValue({
      ...record,
      alternateDateRange: [alternateStartDate, alternateEndDate],
      isDefaultSignatory: record.isDefaultSignatory ?? true, // Default to true if not set
    });
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      try {
        const {
          alternateDateRange,
          isDefaultSignatory,
          iisTransactionNo,
          remarks,
          ...restValues
        } = values;

        let payload = {
          ...restValues,
          isSignatory: true,
          isDefaultSignatory,
        };

        if (!isDefaultSignatory) {
          // Alternate signatory → keep IIS Transaction No. and Remarks
          payload.alternateDateOfEffectivityStart = alternateDateRange
            ? alternateDateRange[0].toDate()
            : null;
          payload.alternateDateOfEffectivityEnd = alternateDateRange
            ? alternateDateRange[1]?.toDate()
            : null;
          payload.iisTransactionNo = iisTransactionNo;
          payload.remarks = remarks;
        } else {
          // Default signatory → clear all alternate-only fields
          payload = {
            ...payload,
            alternateSignatoryEmpId: null,
            alternateSignatoryName: null,
            alternateDateOfEffectivityStart: null,
            alternateDateOfEffectivityEnd: null,
            iisTransactionNo: null, // force clear for default
            remarks: null, // force clear for default
          };
        }

        if (editingSignatory) {
          await updateEmployeeSignatory(editingSignatory._id, payload);
          message.success("Signatory updated successfully!");
        } else {
          const targetEmployee = allRegularEmployees.find(
            (emp) => emp.empId === payload.empId
          );

          if (targetEmployee) {
            if (targetEmployee.isSignatory) {
              message.error("This employee is already a signatory.");
              return;
            }

            const updatePayload = {
              ...payload,
              name: payload.name,
              division: payload.division,
              position: payload.position,
            };

            await updateEmployeeSignatory(targetEmployee._id, updatePayload);
            // Mark this signatory as session-new for demo delete allowance
            markSessionNew(targetEmployee._id);
            message.success("Employee designated as signatory successfully!");
          } else {
            message.error("Employee not found with the provided Employee ID.");
          }
        }

        fetchSignatories();
        setIsModalVisible(false);
      } catch (error) {
        console.error("Save failed:", error);
        message.error("Failed to save signatory.");
      }
    });
  };

  const handleDelete = async (recordId, record) => {
    if (isDemoActive && !isRecordSessionNew(record)) {
      message.warning("Delete disabled in demo for existing signatories");
      return;
    }
    try {
      const payload = {
        isSignatory: true, // Keep them as a signatory
        isDefaultSignatory: false, // Mark as non-default
        isSignatoryActive: false, // Keep this for now, but it might be redundant with isDefaultSignatory
        signatoryDesignation: null, // Clear their designation if they are no longer default
        alternateSignatoryEmpId: null,
        alternateSignatoryName: null,
        alternateDateOfEffectivityStart: null,
        alternateDateOfEffectivityEnd: null,
        iisTransactionNo: null,
        remarks: null,
      };
      await updateEmployeeSignatory(recordId, payload);
      message.success("Signatory status updated successfully!");
      fetchSignatories();
    } catch (error) {
      message.error("Failed to update signatory status.");
    }
  };

  // Build deterministic color map for section/unit labels so colors are stable app-wide
  const sectionOrUnitColorMap = useMemo(
    () => buildColorMapFromList(sectionOrUnitOptions || []),
    [sectionOrUnitOptions]
  );

  const columns = [
    ...(!isMobile
      ? [
          {
            title: "Employee ID",
            dataIndex: "empId",
            key: "empId",
            render: (text) => <Text strong>{text}</Text>,
          },
        ]
      : []),
    {
      title: "Employee Details",
      key: "details",
      width: isMobile ? 160 : 200,
      render: (text, record) => (
        <div className="employee-details">
          <Text className="employee-name">{record.name}</Text>
          {isMobile && (
            <Text type="secondary" style={{ fontSize: '0.8em' }}>
              {record.empId}
            </Text>
          )}
          <Text type="secondary" className="employee-meta">
            {getAcronymFromEnv(record.division, VITE_DIVISION_ACRONYMS)} |{" "}
            {getAcronymFromEnv(record.position, VITE_POSITION_ACRONYMS)}
          </Text>
          {record.signatoryDesignation && record.signatoryDesignation.length > 0 && (
            <div
              className="designation-tags"
              style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}
            >
              {record.signatoryDesignation.map((designation, index) => (
                <Tag
                  key={index}
                  className="designation-tag"
                  color={
                    sectionOrUnitColorMap[designation] ||
                    designationColors[designation] ||
                    pickTagColor(designation)
                  }
                  style={{ margin: 0 }}
                >
                  {getAcronymFromEnv(designation, {
                    ...VITE_DIVISION_ACRONYMS,
                    ...VITE_SECTION_OR_UNIT_ACRONYMS,
                    ...VITE_POSITION_ACRONYMS,
                  })}
                </Tag>
              ))}
            </div>
          )}
          {record.isSignatory && (
            <Tag
              className="signatory-tag"
              color={record.isDefaultSignatory ? "green" : "volcano"}
              style={{ marginTop: 5 }}
            >
              {record.isDefaultSignatory
                ? "Default Signatory"
                : "Alternate Signatory"}
            </Tag>
          )}
        </div>
      ),
    },
    ...(!isMobile
      ? [
          {
            title: "Alternate Signatory",
            key: "alternate",
            render: (text, record) => (
              <div className="employee-details">
                {record.alternateSignatoryEmpId ? (
                  <>
                    <Text className="employee-name">
                      {record.alternateSignatoryName ||
                        record.alternateSignatoryEmpId}
                    </Text>
                    <Text type="secondary" className="employee-meta">
                      {record.alternateDateOfEffectivityStart
                        ? dayjs(record.alternateDateOfEffectivityStart).format(
                            "YYYY-MM-DD"
                          )
                        : "N/A"}
                      {record.alternateDateOfEffectivityEnd &&
                        ` - ${dayjs(record.alternateDateOfEffectivityEnd).format(
                          "YYYY-MM-DD"
                        )}`}
                    </Text>
                  </>
                ) : (
                  <Text type="secondary">N/A</Text>
                )}
              </div>
            ),
          },
          {
            title: (
              <Tooltip title="This is the proof or special order of the approved employee as alternate signatory employee.">
                IIS Transaction No.{" "}
                <InfoCircleOutlined style={{ color: "rgba(0,0,0,.45)" }} />
              </Tooltip>
            ),
            dataIndex: "iisTransactionNo",
            key: "iisTransactionNo",
            render: (text) =>
              text ? (
                <a
                  href={`https://iis.emb.gov.ph/embis/dms/documents/tracker/?trn_no=${text}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {text}
                </a>
              ) : (
                "N/A"
              ),
          },
          {
            title: "Remarks",
            dataIndex: "remarks",
            key: "remarks",
          },
        ]
      : []),
    {
      title: "Actions",
      key: "actions",
      render: (text, record) => {
        const demoDeleteDisabled = isDemoActive && !isRecordSessionNew(record);
        return (
          <span className="action-buttons">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              disabled={readOnly && isDemoActive && isDemoUser}
            />
            <Popconfirm
              title={demoDeleteDisabled ? "Delete disabled in demo for existing entries" : "Are you sure to remove this employee as signatory?"}
              onConfirm={() => handleDelete(record._id, record)}
              okText="Yes"
              cancelText="No"
              disabled={demoDeleteDisabled}
            >
              <Button
                type="primary"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={(readOnly && isDemoActive && isDemoUser) || demoDeleteDisabled}
              />
            </Popconfirm>
          </span>
        );
      },
    },
  ];

  return (
    <Card title="DTR Signatories" variant={false} className="compact-table">
      <Button
        type="primary"
        onClick={showAddModal}
        style={{ marginBottom: 16 }}
        disabled={readOnly && isDemoActive && isDemoUser}
      >
        Add Signatory
      </Button>
      <Table
        className="compact-table"
        columns={columns}
        dataSource={signatories}
        loading={loading}
        rowKey="_id"
        size="small"
        scroll={{ x: isMobile ? 400 : 800 }}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
          defaultPageSize: 10,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} signatories`,
        }}
      />
      <SignatoryModal
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        editingSignatory={editingSignatory}
        form={form}
        sectionOrUnitOptions={sectionOrUnitOptions}
        allEmployees={allRegularEmployees} // Pass filtered employees to the modal
        readOnly={readOnly && isDemoActive && isDemoUser}
      />
    </Card>
  );
};

export default Signatory;
