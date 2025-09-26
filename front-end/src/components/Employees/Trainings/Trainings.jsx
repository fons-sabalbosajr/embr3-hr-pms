import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Transfer,
  Checkbox,
  message,
  Popover,
  Dropdown,
  Menu,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import axiosInstance from "../../../api/axiosInstance";
import dayjs from "dayjs";
import tinycolor from "tinycolor2";
import "./trainings.css";

const { Option } = Select;
const { RangePicker } = DatePicker;

const Trainings = () => {
  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [filters, setFilters] = useState({
    name: "",
    host: "",
    participant: "",
  });
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [useDateRange, setUseDateRange] = useState(false);

  const [form] = Form.useForm();

  useEffect(() => {
    fetchEmployees();
    fetchTrainings();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get("/employees");
      setEmployees(res.data);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  };

  const fetchTrainings = async () => {
    try {
      const res = await axiosInstance.get("/trainings");
      setTrainings(res.data);
    } catch (err) {
      console.error("Failed to fetch trainings", err);
    }
  };

  const openModal = (training = null) => {
    setEditingTraining(training);
    setIsModalOpen(true);

    if (training) {
      setSelectedParticipants(training.participants?.map((p) => p.empId) || []);

      const isRange = training.trainingDate?.length > 1;
      setUseDateRange(isRange);

      // Convert ISO strings to dayjs objects for AntD pickers
      const trainingDateValue = training.trainingDate?.map((d) => dayjs(d));

      form.setFieldsValue({
        name: training.name || "",
        host: training.host || "",
        venue: training.venue || "",
        iisTransaction: training.iisTransaction || "",
        trainingDate: isRange
          ? trainingDateValue // Array of dayjs for RangePicker
          : trainingDateValue?.[0], // Single dayjs for DatePicker
      });
    } else {
      setSelectedParticipants([]);
      form.resetFields();
      setUseDateRange(false); // default single picker
      form.setFieldsValue({
        trainingDate: undefined, // empty by default
      });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTraining(null);
    form.resetFields();
  };

  // --- handleSubmit simplified ---
  const handleSubmit = async (values) => {
    try {
      // If user did not pick a date, use defaults
      let dateField = values.trainingDate;

      if (!dateField) {
        if (useDateRange) {
          // default to this week
          dateField = [dayjs().startOf("week"), dayjs().endOf("week")];
        } else {
          // default to today
          dateField = dayjs();
        }
      }

      // Convert to ISO strings for backend
      let trainingDatePayload = null;
      if (useDateRange) {
        if (Array.isArray(dateField)) {
          trainingDatePayload = [
            dateField[0].toISOString(),
            dateField[1].toISOString(),
          ];
        } else {
          // just in case
          trainingDatePayload = [dateField.toISOString()];
        }
      } else {
        trainingDatePayload = [dateField.toISOString()];
      }

      // Participants payload
      const participantsPayload = selectedParticipants.map((empId) =>
        employees.find((emp) => emp.empId === empId)
      );

      const payload = {
        ...values,
        trainingDate: trainingDatePayload,
        participants: participantsPayload,
        iisTransaction: values.iisTransaction,
      };

      if (editingTraining) {
        await axiosInstance.put(`/trainings/${editingTraining._id}`, payload);
        message.success("Training updated successfully ✅");
      } else {
        await axiosInstance.post("/trainings", payload);
        message.success("Training added successfully ✅");
      }

      fetchTrainings();
      closeModal();
      setSelectedParticipants([]);
    } catch (err) {
      console.error("Failed to save training", err);
      message.error("Failed to save training ❌");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/trainings/${id}`);
      setTrainings((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      console.error("Failed to delete training", err);
    }
  };

  // Filter the table data
  const filteredTrainings = trainings.filter((t) => {
    const nameMatch = t.name.toLowerCase().includes(filters.name.toLowerCase());
    const hostMatch = t.host.toLowerCase().includes(filters.host.toLowerCase());
    const participantMatch = filters.participant
      ? t.participants?.some((p) => p.empId === filters.participant)
      : true;
    return nameMatch && hostMatch && participantMatch;
  });

  const columns = [
    {
      title: () => <span style={{ fontSize: "12px" }}>Training Name</span>,
      dataIndex: "name",
      key: "name",
      align: "center",
      width: 250,
      render: (text) => (
        <div style={{ textAlign: "left", fontSize: "12px" }}>{text}</div>
      ),
    },
    {
      title: () => <span style={{ fontSize: "12px" }}>Training Host</span>,
      dataIndex: "host",
      key: "host",
      align: "center",
      width: 120,
      render: (text) => (
        <div style={{ textAlign: "left", fontSize: "12px" }}>{text}</div>
      ),
    },
    {
      title: () => <span style={{ fontSize: "12px" }}>Venue</span>,
      dataIndex: "venue",
      key: "venue",
      align: "center",
      width: 120,
      render: (text) => (
        <div style={{ textAlign: "left", fontSize: "12px" }}>{text}</div>
      ),
    },
    {
      title: () => <span style={{ fontSize: "12px" }}>Training Date</span>,
      dataIndex: "trainingDate",
      key: "trainingDate",
      align: "center",
      width: 100,
      render: (dates) =>
        dates ? (
          <div style={{ textAlign: "left", fontSize: "12px" }}>
            {dayjs(dates[0]).format("MM/DD/YYYY")} -{" "}
            {dayjs(dates[1]).format("MM/DD/YYYY")}
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: () => <span style={{ fontSize: "12px" }}>Participants</span>,
      dataIndex: "participants",
      key: "participants",
      align: "center",
      render: (participants) => {
        if (!participants) return null;

        // Group participants by division
        const grouped = participants.reduce((acc, emp) => {
          if (!acc[emp.division]) acc[emp.division] = [];
          acc[emp.division].push(emp);
          return acc;
        }, {});

        return (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {Object.entries(grouped).map(([division, emps]) => {
              const divisionColor = divisionColors[division] || "#555";

              // Darken and add transparency for dropdown background
              const dropdownBg = tinycolor(divisionColor)
                .darken(15)
                .setAlpha(0.95)
                .toRgbString();

              return (
                <Dropdown
                  key={division}
                  menu={{
                    items: emps.map((emp) => ({
                      key: emp.empId,
                      label: (
                        <div
                          style={{
                            padding: "2px 8px",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        >
                          {emp.name}{" "}
                          {emp.sectionOrUnit ? `- ${emp.sectionOrUnit}` : ""}
                        </div>
                      ),
                    })),
                    style: {
                      backgroundColor: dropdownBg,
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: "auto",
                    },
                  }}
                  trigger={["click"]}
                >
                  <Tag
                    style={{
                      backgroundColor: divisionColor,
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    {division} ({emps.length})
                  </Tag>
                </Dropdown>
              );
            })}
          </div>
        );
      },
    },
    {
      title: () => (
        <span style={{ fontSize: "12px" }}>IIS Transaction No./RSO No.</span>
      ),
      dataIndex: "iisTransaction",
      key: "iisTransaction",
      align: "center",
      width: 120,
      render: (text) => (
        <div style={{ textAlign: "left", fontSize: "13px" }}>{text}</div>
      ),
    },
    {
      title: () => <span style={{ fontSize: "12px" }}>Actions</span>,
      key: "actions",
      align: "center",
      render: (_, record) => (
        <div style={{ textAlign: "left" }}>
          <Space>
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openModal(record)}
              type="primary"
            />
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => handleDelete(record._id)}
              type="primary"
            />
          </Space>
        </div>
      ),
    },
  ];

  const divisionColors = {
    "Clearance and Permitting Division": "#1f9cca", // blue
    "Finance and Administrative Division": "#283539", // green
    "Environmental Monitoring and Enforcement Division": "#009d8c", // orange
    "Office of the Regional Director": "#cb330e", // pink/red
    "Specialized Team": "#fd8004",
  };

  const divisionShortcuts = {
    CPD: "Clearance and Permitting Division",
    FAD: "Finance and Administrative Division",
    EMED: "Environmental Monitoring and Enforcement Division",
    ORD: "Office of the Regional Director",
    "Specialized Team": "Specialized Team",
  };

  return (
    <div>
      <h2 className="trainings-title">Office Trainings</h2>
      {/* Filters */}
      <div
        className="trainings-filters-container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {/* Filters */}
        <Space wrap>
          <Input
            placeholder="Filter by Training Name"
            value={filters.name}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            allowClear
            style={{ width: 200 }}
          />
          <Input
            placeholder="Filter by Host"
            value={filters.host}
            onChange={(e) => setFilters({ ...filters, host: e.target.value })}
            allowClear
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by Participant"
            allowClear
            style={{ width: 250 }}
            value={filters.participant}
            onChange={(value) => setFilters({ ...filters, participant: value })}
          >
            {employees.map((emp) => (
              <Option key={emp.empId} value={emp.empId}>
                {emp.name} ({emp.empNo})
              </Option>
            ))}
          </Select>
        </Space>

        {/* Add Training Button */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
        >
          Add Training
        </Button>
      </div>

      <div className="trainings-table">
        <Table
          columns={columns}
          dataSource={filteredTrainings}
          rowKey="_id"
          size="small"
        />
      </div>
      {isModalOpen && (
        <Modal
          open={true}
          title={editingTraining ? "Edit Training" : "Add Training"}
          onCancel={closeModal}
          footer={null}
          destroyOnHidden
          className="trainings-modal"
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Training Name"
              name="name"
              rules={[
                { required: true, message: "Please enter training name" },
              ]}
            >
              <Input.TextArea rows={2} />
            </Form.Item>

            <Space.Compact style={{ width: "100%" }}>
              <Form.Item
                label="Training Host"
                name="host"
                rules={[{ required: true, message: "Please enter host" }]}
                style={{ flex: 1 }}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Training Venue"
                name="venue"
                rules={[{ required: true, message: "Please enter venue" }]}
                style={{ flex: 1, marginLeft: 8 }}
              >
                <Input />
              </Form.Item>
            </Space.Compact>

            <Form.Item
              label="Training Date"
              name="trainingDate"
              rules={[{ required: true, message: "Please select a date" }]}
            >
              <Space>
                {useDateRange ? (
                  <RangePicker
                    value={(() => {
                      const val = form.getFieldValue("trainingDate");
                      if (!val || !Array.isArray(val)) return undefined;
                      return [dayjs(val[0]), dayjs(val[1])];
                    })()}
                    onChange={(dates) =>
                      form.setFieldsValue({ trainingDate: dates })
                    }
                    size="small"
                    format="MM/DD/YYYY"
                    allowClear
                  />
                ) : (
                  <DatePicker
                    value={(() => {
                      const val = form.getFieldValue("trainingDate");
                      if (!val || Array.isArray(val)) return undefined;
                      return dayjs(val);
                    })()}
                    onChange={(date) =>
                      form.setFieldsValue({ trainingDate: date })
                    }
                    size="small"
                    format="MM/DD/YYYY"
                    allowClear
                  />
                )}

                <Checkbox
                  checked={useDateRange}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setUseDateRange(isChecked);

                    // Clear picker value when switching to avoid invalid dates
                    form.setFieldsValue({ trainingDate: undefined });
                  }}
                >
                  Use Date Range
                </Checkbox>
              </Space>
            </Form.Item>

            {/* Participants Transfer */}
            <Form.Item
              label="Participants"
              name="participants"
              rules={[
                {
                  validator: (_, value) =>
                    selectedParticipants && selectedParticipants.length
                      ? Promise.resolve()
                      : Promise.reject(new Error("Select participants")),
                },
              ]}
            >
              <Transfer
                className="compact-transfer"
                dataSource={employees
                  .map((emp) => ({
                    key: emp.empId,
                    title: emp.name,
                    description: emp.empNo,
                    division: emp.division,
                    section: emp.sectionOrUnit,
                  }))
                  .sort((a, b) => a.title.localeCompare(b.title))}
                showSearch
                searchPlaceholder="Search name, division, section, or acronym..."
                listStyle={{ width: 250, height: 300 }}
                targetKeys={selectedParticipants}
                onChange={setSelectedParticipants}
                render={(item) => (
                  <span
                    style={{ color: divisionColors[item.division] || "#000" }}
                  >
                    {item.title}
                  </span>
                )}
                filterOption={(inputValue, item) => {
                  const lowerInput = inputValue.toLowerCase();
                  const nameMatch = item.title
                    .toLowerCase()
                    .includes(lowerInput);
                  const divisionMatch = item.division
                    .toLowerCase()
                    .includes(lowerInput);
                  const sectionMatch = (item.section || "")
                    .toLowerCase()
                    .includes(lowerInput);
                  const shortcutMatch = Object.entries(divisionShortcuts).some(
                    ([shortcut, full]) =>
                      shortcut.toLowerCase() === lowerInput &&
                      item.division === full
                  );
                  return (
                    nameMatch || divisionMatch || sectionMatch || shortcutMatch
                  );
                }}
                renderList={(listProps) => {
                  const { direction, filteredItems, onItemSelect } = listProps;

                  if (direction === "left") {
                    const grouped = filteredItems.reduce((acc, item) => {
                      if (!acc[item.division]) acc[item.division] = [];
                      acc[item.division].push(item);
                      return acc;
                    }, {});

                    return (
                      <div
                        style={{
                          width: 250,
                          minHeight: 300,
                          maxHeight: 300,
                          overflowY: "auto",
                          border: "1px solid #d9d9d9",
                          borderRadius: 4,
                          padding: "4px",
                        }}
                      >
                        {Object.entries(grouped).map(([division, items]) => (
                          <div key={division} style={{ marginBottom: 8 }}>
                            <div
                              style={{ fontWeight: "bold", marginBottom: 4 }}
                            >
                              {division}
                            </div>
                            {items.map((item) => (
                              <div
                                key={item.key}
                                onClick={() =>
                                  onItemSelect(
                                    item.key,
                                    !selectedParticipants.includes(item.key)
                                  )
                                }
                                style={{
                                  padding: "2px 4px",
                                  cursor: "pointer",
                                  background: selectedParticipants.includes(
                                    item.key
                                  )
                                    ? "#e6f7ff"
                                    : undefined,
                                  borderRadius: 2,
                                  marginBottom: 2,
                                }}
                              >
                                {item.title}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Right side: selected participants tags
                  return (
                    <div
                      style={{
                        width: 250,
                        minHeight: 300,
                        maxHeight: 300,
                        overflowY: "auto",
                        padding: "4px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        border: "1px solid #d9d9d9",
                        borderRadius: 4,
                        background: "#fff",
                      }}
                    >
                      {filteredItems.map((item) => (
                        <Tag
                          key={item.key}
                          closable
                          onClose={(e) => {
                            e.preventDefault();
                            setSelectedParticipants((prev) =>
                              prev.filter((k) => k !== item.key)
                            );
                          }}
                          style={{
                            fontSize: "11px",
                            color: divisionColors[item.division],
                          }}
                        >
                          {item.title}
                        </Tag>
                      ))}
                    </div>
                  );
                }}
                locale={{
                  itemUnit: "personnel",
                  itemsUnit: "personnel",
                  searchPlaceholder: "Search personnel...",
                }}
              />
            </Form.Item>

            {/* --- IIS Transaction Field simplified --- */}
            <Form.Item
              label="Special Order No. / IIS Transaction No."
              name="iisTransaction"
              rules={[
                {
                  required: true,
                  message:
                    "Please enter Special Order No. or IIS Transaction No.",
                },
              ]}
            >
              <Input placeholder="Enter Special Order No. or IIS Transaction No." />
            </Form.Item>

            <Form.Item>
              <Space style={{ display: "flex", justifyContent: "end" }}>
                <Button onClick={closeModal}>Cancel</Button>
                <Button type="primary" htmlType="submit">
                  {editingTraining ? "Update" : "Add"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default Trainings;
