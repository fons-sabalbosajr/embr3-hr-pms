import React, { useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Switch,
  Row,
  Col,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import { InfoCircleOutlined } from "@ant-design/icons";

const { RangePicker } = DatePicker;
const { Option } = Select;

const SignatoryModal = ({
  visible,
  onOk,
  onCancel,
  editingSignatory,
  form,
  sectionOrUnitOptions,
  allEmployees,
  readOnly = false,
}) => {
  const isDefaultSignatory = Form.useWatch("isDefaultSignatory", form);

  useEffect(() => {
    if (!editingSignatory) {
      form.resetFields();
      form.setFieldsValue({ isDefaultSignatory: true }); // Default to default for new signatories
    } else {
      const alternateStartDate =
        editingSignatory.alternateDateOfEffectivityStart
          ? dayjs(editingSignatory.alternateDateOfEffectivityStart)
          : null;
      const alternateEndDate = editingSignatory.alternateDateOfEffectivityEnd
        ? dayjs(editingSignatory.alternateDateOfEffectivityEnd)
        : null;

      form.setFieldsValue({
        ...editingSignatory,
        dateRange: [null, null], // Main date range is removed
        alternateDateRange: [alternateStartDate, alternateEndDate],
        isDefaultSignatory: editingSignatory.isDefaultSignatory ?? true, // Default to true if not set
        iisTransactionNo: editingSignatory.iisTransactionNo || null, // Explicitly set iisTransactionNo
      });
    }
  }, [editingSignatory, form]);

  const handleEmployeeNameChange = (employeeId) => {
    const selectedEmployee = allEmployees.find(
      (emp) => emp.empId === employeeId
    );
    if (selectedEmployee) {
      form.setFieldsValue({
        empId: selectedEmployee.empId,
        name: selectedEmployee.name,
        division: selectedEmployee.division,
        position: selectedEmployee.position,
      });
    }
  };

  const handleAlternateEmployeeNameChange = (employeeId) => {
    const selectedEmployee = allEmployees.find(
      (emp) => emp.empId === employeeId
    );
    if (selectedEmployee) {
      form.setFieldsValue({
        alternateSignatoryEmpId: selectedEmployee.empId,
        alternateSignatoryName: selectedEmployee.name,
      });
    }
  };

  return (
    <Modal
      title={editingSignatory ? "Edit Signatory" : "Add Signatory"}
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ disabled: readOnly }}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={18}>
            <Form.Item
              name="name"
              label="Employee Name"
              rules={[
                { required: true, message: "Please select an employee!" },
              ]}
            >
              <Select
                showSearch
                placeholder="Select an employee"
                optionFilterProp="children"
                onChange={handleEmployeeNameChange}
                filterOption={(input, option) =>
                  (option?.children ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                disabled={!!editingSignatory || readOnly} // Disable if editing or demo read-only
              >
                {allEmployees.map((employee) => (
                  <Option key={employee.empId} value={employee.empId}>
                    {employee.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="isDefaultSignatory"
              label="Signatory"
              valuePropName="checked"
              rules={[{ required: true }]}
            >
              <Switch size="small" checkedChildren="Default" unCheckedChildren="Alternate" disabled={readOnly} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="empId"
          label="Employee ID"
          rules={[{ required: true }]}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          name="division"
          label="Division"
          rules={[{ required: true }]}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          name="position"
          label="Position"
          rules={[{ required: true }]}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          name="signatoryDesignation"
          label="Unit/Section Signatory Designation"
          rules={[
            {
              required: true,
              message: "Please select at least one designation!",
            },
          ]}
        >
          <Select mode="multiple" placeholder="Select designations" disabled={readOnly}>
            {sectionOrUnitOptions.map((option) => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {!isDefaultSignatory && (
          <>
            <Form.Item
              name="alternateSignatoryEmpId"
              label="Alternate Signatory Employee Name"
            >
              <Select
                showSearch
                placeholder="Select an alternate employee"
                optionFilterProp="children"
                onChange={handleAlternateEmployeeNameChange}
                filterOption={(input, option) =>
                  (option?.children ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                disabled={readOnly}
              >
                {allEmployees.map((employee) => (
                  <Option key={employee.empId} value={employee.empId}>
                    {employee.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            {/* Hidden Form.Item to capture alternateSignatoryName */}
            <Form.Item name="alternateSignatoryName" hidden>
              <Input />
            </Form.Item>
            <Form.Item
              name="alternateDateRange"
              label="Alternate Date of Effectivity"
            >
              <RangePicker style={{ width: "100%" }} disabled={readOnly} />
            </Form.Item>
            <Tooltip title="This is the proof or special order of the approved employee as alternate signatory employee.">
              <Form.Item name="iisTransactionNo" label="IIS Transaction No.">
                <Input
                  suffix={
                    <InfoCircleOutlined style={{ color: "rgba(0,0,0,.45)" }} />
                  }
                  disabled={readOnly}
                />
              </Form.Item>
            </Tooltip>

            <Form.Item name="remarks" label="Remarks">
              <Input.TextArea disabled={readOnly} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default SignatoryModal;
