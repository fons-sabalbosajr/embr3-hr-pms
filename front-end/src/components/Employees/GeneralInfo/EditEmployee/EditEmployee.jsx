import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  message,
  Divider,
  Space,
  Tag,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import axios from "../../../../api/axiosInstance";

const { Option } = Select;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i; // simple, pragmatic validator

const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val))
    return val.map((v) => String(v).trim()).filter(Boolean);
  if (typeof val === "string") {
    return val
      .split(/[,\s]+/) // split on comma or whitespace
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const EditEmployee = ({ employee, onClose, onUpdated }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [newSection, setNewSection] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [showSectionRemove, setShowSectionRemove] = useState(false);
  const [showDivisionRemove, setShowDivisionRemove] = useState(false);

  useEffect(() => {
    // Preload dropdown options
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    if (!employee) return;

    // Normalize initial values, especially emails -> array
    const normalized = {
      ...employee,
      emails: toArray(employee.emails),
      // keep alternateEmpIds as a comma string for the text input UX
      alternateEmpIds: Array.isArray(employee.alternateEmpIds)
        ? employee.alternateEmpIds.join(", ")
        : employee.alternateEmpIds ?? "",
    };

    form.setFieldsValue(normalized);
  }, [employee, form]);

  const checkEmpIdUnique = async (empId) => {
    try {
      const res = await axios.get("/employees/check-empId", {
        params: {
          empId,
          excludeId: employee?._id, // exclude current employee's own ID from check
        },
      });
      return res.data.isUnique;
    } catch (error) {
      console.error("Error checking empId uniqueness", error);
      // Fail open: if error happens, allow submission to proceed
      return true;
    }
  };

  const fetchDropdownOptions = async () => {
    try {
      const res = await axios.get("/employees");
      const data = res.data || [];

      const sections = [
        ...new Set(
          data
            .map((e) => e.sectionOrUnit?.trim())
            .filter((v) => v && v.length > 0)
        ),
      ];

      const divisions = [
        ...new Set(
          data.map((e) => e.division?.trim()).filter((v) => v && v.length > 0)
        ),
      ];

      setSectionOptions(sections);
      setDivisionOptions(divisions);
    } catch (error) {
      console.error("Failed to fetch dropdown options", error);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Check empId uniqueness first
      const isUnique = await checkEmpIdUnique(values.empId);

      if (!isUnique) {
        message.error(`Employee ID "${values.empId}" is already taken.`);
        setLoading(false);
        return;
      }

      let altIds = [];
      if (values.alternateEmpIds) {
        if (Array.isArray(values.alternateEmpIds)) {
          altIds = values.alternateEmpIds.map((id) => String(id).trim());
        } else if (typeof values.alternateEmpIds === "string") {
          altIds = values.alternateEmpIds
            .split(/[,\s]+/)
            .map((id) => id.trim())
            .filter(Boolean);
        }
        altIds = Array.from(new Set(altIds));
      }

      let emails = toArray(values.emails);
      const bad = emails.filter((e) => !EMAIL_RE.test(e));
      if (bad.length) {
        message.error(`Invalid email(s): ${bad.join(", ")}`);
        setLoading(false);
        return;
      }
      emails = Array.from(new Set(emails));

      const sectionOrUnit =
        Array.isArray(values.sectionOrUnit) && values.sectionOrUnit.length
          ? values.sectionOrUnit[0]
          : values.sectionOrUnit || undefined;

      const division =
        Array.isArray(values.division) && values.division.length
          ? values.division[0]
          : values.division || undefined;

      const payload = {
        ...values,
        sectionOrUnit,
        division,
        alternateEmpIds: altIds,
        emails,
        email: emails[0] || undefined,
      };

      await axios.put(`/employees/${employee._id}`, payload);

      message.success("Employee updated successfully.");
      onUpdated?.({ ...employee, ...payload });
      onClose();
    } catch (err) {
      console.error("Failed to update employee:", err);
      message.error("Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.Item name="empId" label="ID Number" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.Item
        name="alternateEmpIds"
        label="Alternate Employee IDs (comma or space separated)"
        tooltip="You can paste comma/space separated IDs; we'll parse and dedupe."
      >
        <Input placeholder="e.g. 12345, 67890" />
      </Form.Item>

      {/* 📧 Multi-value Email as tags */}
      <Form.Item
        name="emails"
        label="Email(s)"
        tooltip="Type an email and press Enter; commas and spaces also split."
        rules={[
          {
            validator: (_, value) => {
              const arr = toArray(value);
              const bad = arr.filter((e) => !EMAIL_RE.test(e));
              return bad.length
                ? Promise.reject(
                    new Error(`Invalid email(s): ${bad.join(", ")}`)
                  )
                : Promise.resolve();
            },
          },
        ]}
      >
        <Select
          mode="tags"
          tokenSeparators={[",", " "]}
          placeholder="e.g. user1@example.com, user2@example.com"
          allowClear
        />
      </Form.Item>

      <Form.Item name="position" label="Position" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      {/* Section/Unit Dropdown (single select with "Add new") */}
      <Form.Item name="sectionOrUnit" label="Section/Unit">
        <Select
          showSearch
          allowClear
          placeholder="Select or add Section/Unit"
          options={sectionOptions
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((section) => ({ value: section, label: section }))}
          popupRender={(menu) => (
            <>
              {menu}

              {/* Add + Manage Row */}
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ display: "flex", gap: 4, padding: "0 8px 4px" }}>
                <Input
                  placeholder="Add new Section/Unit"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  style={{
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    fontSize: 11,
                    marginTop: 4,
                  }}
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const v = newSection.trim();
                    if (v && !sectionOptions.includes(v)) {
                      setSectionOptions((prev) =>
                        [...prev, v].sort((a, b) => a.localeCompare(b))
                      );
                      form.setFieldsValue({ sectionOrUnit: v });
                      setNewSection("");
                    }
                  }}
                >
                  Add
                </Button>

                <Button
                  type="primary"
                  style={{
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    whiteSpace: "nowrap",
                    fontSize: 11,
                    marginTop: 4,
                  }}
                  size="small"
                  onClick={() => setShowSectionRemove(!showSectionRemove)}
                >
                  {showSectionRemove ? "Hide Options" : "Manage Options"}
                </Button>
              </div>

              {/* Remove tags section */}
              {showSectionRemove && (
                <div
                  style={{
                    padding: "4px 8px",
                    maxHeight: 120,
                    overflowY: "auto",
                    marginTop: 4,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {sectionOptions.map((sec) => (
                    <Tag
                      key={sec}
                      closable
                      onClose={(e) => {
                        e.preventDefault();
                        setSectionOptions((prev) =>
                          prev.filter((s) => s !== sec)
                        );
                        if (form.getFieldValue("sectionOrUnit") === sec) {
                          form.setFieldsValue({ sectionOrUnit: undefined });
                        }
                      }}
                    >
                      {sec}
                    </Tag>
                  ))}
                </div>
              )}
            </>
          )}
        />
      </Form.Item>

      {/* Division Dropdown (single select with "Add new") */}
      <Form.Item name="division" label="Division">
        <Select
          showSearch
          allowClear
          placeholder="Select or add Division"
          options={divisionOptions
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((division) => ({ value: division, label: division }))}
          popupRender={(menu) => (
            <>
              {menu}

              {/* Add + Manage Row */}
              <Divider style={{ margin: "8px 0" }} />
              <div style={{ display: "flex", gap: 4, padding: "0 8px 4px" }}>
                <Input
                  placeholder="Add new Division"
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  style={{
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    marginTop: 4,
                    fontSize: 11,
                  }}
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const v = newDivision.trim();
                    if (v && !divisionOptions.includes(v)) {
                      setDivisionOptions((prev) =>
                        [...prev, v].sort((a, b) => a.localeCompare(b))
                      );
                      form.setFieldsValue({ division: v });
                      setNewDivision("");
                    }
                  }}
                >
                  Add
                </Button>

                <Button
                  type="primary"
                  style={{
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    whiteSpace: "nowrap",
                    marginTop: 4,
                    fontSize: 11,
                  }}
                  size="small"
                  onClick={() => setShowDivisionRemove(!showDivisionRemove)}
                >
                  {showDivisionRemove ? "Hide Options" : "Manage Options"}
                </Button>
              </div>

              {/* Remove tags section */}
              {showDivisionRemove && (
                <div
                  style={{
                    padding: "4px 8px",
                    maxHeight: 120,
                    overflowY: "auto",
                    marginTop: 4,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {divisionOptions.map((div) => (
                    <Tag
                      key={div}
                      closable
                      onClose={(e) => {
                        e.preventDefault();
                        setDivisionOptions((prev) =>
                          prev.filter((d) => d !== div)
                        );
                        if (form.getFieldValue("division") === div) {
                          form.setFieldsValue({ division: undefined });
                        }
                      }}
                    >
                      {div}
                    </Tag>
                  ))}
                </div>
              )}
            </>
          )}
        />
      </Form.Item>

      <Form.Item
        name="empType"
        label="Employee Type"
        rules={[{ required: true }]}
      >
        <Select placeholder="Select employee type">
          <Option value="Regular">Regular</Option>
          <Option value="Contractual">Contractual</Option>
        </Select>
      </Form.Item>

      <Form.Item>
        <Button htmlType="submit" type="primary" block loading={loading}>
          {loading ? "Updating..." : "Save Changes"}
        </Button>
      </Form.Item>
    </Form>
  );
};

export default EditEmployee;
