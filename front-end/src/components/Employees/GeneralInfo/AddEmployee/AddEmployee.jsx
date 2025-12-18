// AddEmployee.jsx
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  Select,
  message,
  Spin,
  Row,
  Col,
  Tag,
  Typography,
} from "antd";
import axiosInstance from "../../../../api/axiosInstance";

const { Option } = Select;
const { Text } = Typography;

const AddEmployee = ({ onClose, onEmpNoChange }) => {
  const [form] = Form.useForm();
  const [sectionOptions, setSectionOptions] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [newSection, setNewSection] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [showSectionRemove, setShowSectionRemove] = useState(false);
  const [showDivisionRemove, setShowDivisionRemove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empNoLoading, setEmpNoLoading] = useState(false);

  // Fetch dropdown options from existing employees
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const res = await axiosInstance.get("/employees");
        const employees = res.data || [];

        const sections = Array.from(
          new Set(
            employees.map((emp) => emp.sectionOrUnit?.trim()).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        const divisions = Array.from(
          new Set(
            employees.map((emp) => emp.division?.trim()).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        const positions = Array.from(
          new Set(
            employees.map((emp) => emp.position?.trim()).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        setSectionOptions(sections);
        setDivisionOptions(divisions);
        setPositionOptions(positions);
      } catch (error) {
        console.error("Failed to fetch dropdown data", error);
      }
    };

    fetchDropdownOptions();
  }, []);

  // Auto-generate empNo when empType changes
  const handleEmpTypeChange = async (value) => {
    form.setFieldsValue({ empType: value, empNo: "" });
    if (!value) {
      onEmpNoChange?.("");
      return;
    }

    try {
      setEmpNoLoading(true);
      const res = await axiosInstance.get(`/employees/latest-empno/${value}`);
      if (res.data?.empNo) {
        form.setFieldsValue({ empNo: res.data.empNo });
        onEmpNoChange?.(res.data.empNo); // update parent with new empNo
      } else {
        onEmpNoChange?.("");
      }
    } catch (err) {
      console.error("Error fetching latest empNo", err);
      message.error("Failed to fetch latest employee number");
      onEmpNoChange?.("");
    } finally {
      setEmpNoLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      const payload = {
        ...values,
        emails: values.email
          ? values.email
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean)
          : [],
        alternateEmpIds: values.alternateEmpIds
          ? values.alternateEmpIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : [],
      };

      delete payload.email;

      // Use axiosInstance so interceptors/baseURL are applied
      const res = await axiosInstance.post("/employees", payload);

      const created = res.data;

      message.success("Employee added successfully");
      // Inform parent of newly created employee so it can open profile or refresh optimistically
      onClose?.(created);
      form.resetFields();
    } catch (error) {
      console.error("Failed to add employee:", error);
      message.error("Failed to add employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="name"
              label="Full Name"
              rules={[
                { required: true, message: "Please enter employee name" },
              ]}
            >
              <Input placeholder="Enter full name" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="empType"
              label="Employee Type"
              rules={[
                { required: true, message: "Please select employee type" },
              ]}
            >
              <Select
                placeholder="Select employee type"
                onChange={handleEmpTypeChange}
              >
                <Option value="Regular">Regular</Option>
                <Option value="Contract of Service">Contract of Service</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="empId"
              label="Employee ID"
              rules={[{ required: true, message: "Please enter employee ID" }]}
            >
              <Input placeholder="Enter employee ID (e.g. 03-1176)" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="alternateEmpIds" label="Alternate Employee IDs">
              <Input placeholder="Enter alternate IDs, separated by comma" />
            </Form.Item>
          </Col>
        </Row>

        {/* Email */}
        <Form.Item name="email" label="Email Address(es)">
          <Input placeholder="Enter email(s), separated by comma" />
        </Form.Item>

        {/* Division */}
        <Form.Item name="division" label="Division">
          <Select
            showSearch
            allowClear
            placeholder="Select or type Division"
            popupMatchSelectWidth={false}
            popupRender={(menu) => (
              <>
                {menu}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: 8, display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="Add new Division"
                    value={newDivision}
                    onChange={(e) => setNewDivision(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      const v = newDivision.trim();
                      if (v && !divisionOptions.includes(v)) {
                        setDivisionOptions((prev) => [...prev, v].sort((a, b) => a.localeCompare(b)));
                        form.setFieldsValue({ division: v });
                        setNewDivision("");
                      }
                    }}
                  >
                    Add
                  </Button>
                  <Button size="small" onClick={() => setShowDivisionRemove(!showDivisionRemove)}>
                    {showDivisionRemove ? 'Hide' : 'Manage'}
                  </Button>
                </div>

                {showDivisionRemove && (
                  <div style={{ padding: '4px 8px', maxHeight: 120, overflowY: 'auto', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {divisionOptions.map((div) => (
                      <Tag key={div} closable onClose={(e) => { e.preventDefault(); setDivisionOptions((prev) => prev.filter((d) => d !== div)); if (form.getFieldValue('division') === div) form.setFieldsValue({ division: undefined }); }}>
                        {div}
                      </Tag>
                    ))}
                  </div>
                )}
              </>
            )}
          >
            {divisionOptions.map((division) => (
              <Option key={division} value={division}>
                {division}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Section/Unit */}
        <Form.Item name="sectionOrUnit" label="Section/Unit">
          <Select
            showSearch
            allowClear
            placeholder="Select or type Section/Unit"
            popupMatchSelectWidth={false}
            popupRender={(menu) => (
              <>
                {menu}
                <div style={{ borderTop: '1px solid #f0f0f0', padding: 8, display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="Add new Section/Unit"
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      const v = newSection.trim();
                      if (v && !sectionOptions.includes(v)) {
                        setSectionOptions((prev) => [...prev, v].sort((a, b) => a.localeCompare(b)));
                        form.setFieldsValue({ sectionOrUnit: v });
                        setNewSection("");
                      }
                    }}
                  >
                    Add
                  </Button>
                  <Button size="small" onClick={() => setShowSectionRemove(!showSectionRemove)}>
                    {showSectionRemove ? 'Hide' : 'Manage'}
                  </Button>
                </div>

                {showSectionRemove && (
                  <div style={{ padding: '4px 8px', maxHeight: 120, overflowY: 'auto', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sectionOptions.map((sec) => (
                      <Tag key={sec} closable onClose={(e) => { e.preventDefault(); setSectionOptions((prev) => prev.filter((s) => s !== sec)); if (form.getFieldValue('sectionOrUnit') === sec) form.setFieldsValue({ sectionOrUnit: undefined }); }}>
                        {sec}
                      </Tag>
                    ))}
                  </div>
                )}
              </>
            )}
          >
            {sectionOptions.map((section) => (
              <Option key={section} value={section}>
                {section}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Position (Dropdown + Search) */}
        <Form.Item name="position" label="Position">
          <Select
            showSearch
            allowClear
            placeholder="Select or type Position"
            popupMatchSelectWidth={false}
          >
            {positionOptions.map((pos) => (
              <Option key={pos} value={pos}>
                {pos}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Submit */}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Add Employee
          </Button>
        </Form.Item>
      </Form>
    </Spin>
  );
};

export default AddEmployee;
