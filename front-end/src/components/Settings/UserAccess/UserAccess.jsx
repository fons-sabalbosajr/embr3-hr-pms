import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Badge,
  Avatar,
  Card,
  Switch,
  Typography,
  Table,
  Modal,
  Button,
  Collapse,
  List,
  Tag,
  Radio,
  Space,
  Descriptions,
  Tooltip,
  theme,
  Tabs,
  Input,
  Popconfirm,
  App as AntApp,
  Select,
  Alert,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  SettingOutlined,
  DollarOutlined,
  TeamOutlined,
  EditOutlined,
  ClockCircleOutlined,
  ReadOutlined,
  MessageOutlined,
  SaveOutlined,
  SafetyOutlined,
  UserOutlined,
  MailOutlined,
  IdcardOutlined,
  ToolOutlined,
  WarningOutlined,
  SearchOutlined,
  CheckOutlined,
  StopOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../api/axiosInstance";
import useAuth from "../../../hooks/useAuth";
import UserAvatar from "../../common/UserAvatar";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Panel } = Collapse;

const groupIcons = {
  general: <SettingOutlined />,
  employees: <TeamOutlined />,
  dtrPayroll: <ClockCircleOutlined />,
  trainings: <ReadOutlined />,
  messaging: <MessageOutlined />,
  danger: <WarningOutlined />,
};

const permIcons = {
  canViewDashboard: <DashboardOutlined />,
  canAccessSettings: <SettingOutlined />,
  showSalaryAmounts: <DollarOutlined />,
  canViewEmployees: <TeamOutlined />,
  canEditEmployees: <EditOutlined />,
  canViewDTR: <ClockCircleOutlined />,
  canProcessDTR: <ToolOutlined />,
  canViewPayroll: <DollarOutlined />,
  canProcessPayroll: <SaveOutlined />,
  canViewTrainings: <ReadOutlined />,
  canEditTrainings: <EditOutlined />,
  canChangeDeductions: <SettingOutlined />,
  canPerformBackup: <SaveOutlined />,
  canManipulateBiometrics: <ToolOutlined />,
  canViewMessages: <MessageOutlined />,
  canManageMessages: <MessageOutlined />,
  isAdmin: <SafetyOutlined />,
  canManageUsers: <SafetyOutlined />,
  canAccessDeveloper: <ToolOutlined />,
  canSeeDev: <ToolOutlined />,
};

const StatusTag = ({ enabled }) => (
  <Tag
    icon={enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
    color={enabled ? "green" : "default"}
    style={{ marginInlineEnd: 0 }}
  >
    {enabled ? "Enabled" : "Disabled"}
  </Tag>
);

// Permission config for clean mapping
const accessGroups = [
  {
    key: "general",
    title: "General Access",
    permissions: [
      {
        key: "canViewDashboard",
        label: "Can View Dashboard",
        description: "Allows user to view the system dashboard with analytics.",
      },
      {
        key: "canAccessSettings",
        label: "Can Access Settings",
        description:
          "Allows user to configure system settings and preferences.",
      },
      {
        key: "showSalaryAmounts",
        label: "Show Salary Amounts",
        description: "Allows user to view sensitive salary details in payroll.",
      },
    ],
  },
  {
    key: "employees",
    title: "Employee Management",
    permissions: [
      {
        key: "canViewEmployees",
        label: "Can View Employees",
        description: "Allows user to view employee records.",
      },
      {
        key: "canEditEmployees",
        label: "Can Edit Employees",
        description: "Allows user to modify employee records.",
      },
    ],
  },
  {
    key: "dtrPayroll",
    title: "DTR & Payroll",
    permissions: [
      {
        key: "canViewDTR",
        label: "Can View DTR",
        description: "Allows user to view daily time records.",
      },
      {
        key: "canProcessDTR",
        label: "Can Process DTR",
        description: "Allows user to generate or process daily time records.",
      },
      {
        key: "canViewPayroll",
        label: "Can View Payroll",
        description: "Allows user to view payroll data.",
      },
      {
        key: "canProcessPayroll",
        label: "Can Process Payroll",
        description: "Allows user to process payroll runs.",
      },
    ],
  },
  {
    key: "trainings",
    title: "Trainings & Others",
    permissions: [
      {
        key: "canViewTrainings",
        label: "Can View Trainings",
        description: "Allows user to view training schedules and records.",
      },
      {
        key: "canEditTrainings",
        label: "Can Edit Trainings",
        description: "Allows user to create or modify trainings.",
      },
      {
        key: "canChangeDeductions",
        label: "Can Change Deductions",
        description: "Allows user to configure deductions.",
      },
      {
        key: "canPerformBackup",
        label: "Can Perform Backup",
        description: "Allows user to perform database backups.",
      },
      {
        key: "canManipulateBiometrics",
        label: "Can Manipulate Biometrics",
        description: "Allows user to override or change biometrics data.",
      },
    ],
  },
  {
    key: "messaging",
    title: "Messaging",
    permissions: [
      {
        key: "canViewMessages",
        label: "Can View Messages",
        description:
          "Allows user to view real-time DTR messages in the popover.",
      },
      {
        key: "canManageMessages",
        label: "Can Manage Messages",
        description: "Allows user to mark messages as read in the popover.",
      },
    ],
  },
];

// Danger Zone Config
const dangerZone = {
  key: "danger",
  title: "Navigation & Security Hierarchy (Danger Zone)",
  permissions: [
    {
      key: "isAdmin",
      label: "Administrator Access",
      description: "Full admin privileges for this user.",
    },
    {
      key: "canManageUsers",
      label: "Can Manage Users",
      description: "Allows user to create, update, and remove user accounts.",
    },
    {
      key: "canAccessDeveloper",
      label: "Can Access Developer Settings",
      description:
        "Allows user to manage developer settings and other system data.",
    },
    {
      key: "canSeeDev",
      label: "Developer Access (legacy flag)",
      description: "Alternate flag for developer access (can be used by older clients).",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

const UserAccess = () => {
  const { user: currentUser, updateCurrentUser } = useAuth();
  const { token: themeToken } = theme.useToken();
  const { message: antMsg } = AntApp.useApp();
  const [activeTab, setActiveTab] = useState("accounts");

  // ── Current accounts state ───────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState("");

  // ── Signup requests state ────────────────────────────────────────
  const [signups, setSignups] = useState([]);
  const [loadingSignups, setLoadingSignups] = useState(false);
  const [signupFilter, setSignupFilter] = useState("pending");
  const [signupSearch, setSignupSearch] = useState("");
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // ── Fetch current accounts ──────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await axiosInstance.get("/users");
      if (response.data.success) {
        // Show all verified users in the Current Accounts tab
        setUsers(
          (response.data.data || []).filter(
            (u) => u.isVerified !== false
          )
        );
      }
    } catch (error) {
      antMsg.error("Failed to fetch users");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ── Fetch signup requests ───────────────────────────────────────
  const fetchSignups = useCallback(async () => {
    setLoadingSignups(true);
    try {
      const response = await axiosInstance.get(`/users/signups?status=${signupFilter}`);
      if (response.data.success) {
        setSignups(response.data.data || []);
      }
    } catch (error) {
      antMsg.error("Failed to fetch signup requests");
    } finally {
      setLoadingSignups(false);
    }
  }, [signupFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchSignups();
  }, [fetchSignups]);

  // ── Access management handlers ──────────────────────────────────
  const handleToggle = async (userId, key, value) => {
    try {
      const response = await axiosInstance.put(`/users/${userId}/access`, {
        [key]: value,
      });
      if (response.data.success) {
        const updatedUser = response.data.data;
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? updatedUser : u))
        );
        setSelectedUser(updatedUser);
        if (currentUser._id === userId) {
          updateCurrentUser(updatedUser);
        }
        antMsg.success("Updated successfully.");
      } else {
        antMsg.error(response.data.message || "Failed to update user access");
      }
    } catch (error) {
      antMsg.error("Failed to update user access");
    }
  };

  const showModal = (user) => {
    setSelectedUser(user);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedUser(null);
  };

  // ── Signup approval handlers ────────────────────────────────────
  const handleApprove = async (userId) => {
    try {
      const res = await axiosInstance.put(`/users/${userId}/approve`);
      if (res.data.success) {
        antMsg.success(res.data.message || "User approved");
        fetchSignups();
        fetchUsers();
      }
    } catch (error) {
      antMsg.error("Failed to approve user");
    }
  };

  const handleRejectClick = (user) => {
    setRejectTarget(user);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    try {
      const res = await axiosInstance.put(`/users/${rejectTarget._id}/reject`, {
        reason: rejectReason,
      });
      if (res.data.success) {
        antMsg.success("User rejected");
        setRejectModalVisible(false);
        setRejectTarget(null);
        fetchSignups();
      }
    } catch (error) {
      antMsg.error("Failed to reject user");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const res = await axiosInstance.delete(`/users/${userId}`);
      if (res.data.success) {
        antMsg.success("User deleted");
        fetchSignups();
        fetchUsers();
      }
    } catch (error) {
      antMsg.error("Failed to delete user");
    }
  };

  // ── Table helpers ───────────────────────────────────────────────
  const tableAccessIcons = useMemo(
    () => [
      { key: "isAdmin", label: "Admin", icon: <SafetyOutlined /> },
      { key: "canManageUsers", label: "Manage Users", icon: <SafetyOutlined /> },
      { key: "canAccessSettings", label: "Settings", icon: <SettingOutlined /> },
      { key: "canProcessDTR", label: "Process DTR", icon: <ClockCircleOutlined /> },
      { key: "canProcessPayroll", label: "Process Payroll", icon: <DollarOutlined /> },
      { key: "canPerformBackup", label: "Backup", icon: <SaveOutlined /> },
      { key: "canAccessDeveloper", label: "Developer", icon: <ToolOutlined /> },
    ],
    []
  );

  const renderAccessIcons = (u) => (
    <Space size={10} wrap>
      {tableAccessIcons.map((a) => {
        const enabled = Boolean(u?.[a.key]);
        const iconStyle = {
          color: enabled ? themeToken.colorSuccess : themeToken.colorTextTertiary,
          fontSize: 16,
          lineHeight: 1,
        };
        return (
          <Tooltip key={a.key} title={`${a.label}: ${enabled ? "Enabled" : "Disabled"}`}>
            <Badge status={enabled ? "success" : "default"}>
              <span style={{ display: "inline-flex", alignItems: "center", ...iconStyle }}>
                {a.icon}
              </span>
            </Badge>
          </Tooltip>
        );
      })}
    </Space>
  );

  // ── Filtered users ──────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.trim().toLowerCase();
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredSignups = useMemo(() => {
    if (!signupSearch.trim()) return signups;
    const q = signupSearch.trim().toLowerCase();
    return signups.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [signups, signupSearch]);

  const pendingCount = useMemo(
    () => signups.filter((s) => (s.approvalStatus || "pending") === "pending").length,
    [signups]
  );

  // ═══════════════════════════════════════════════════════════════
  // TAB 1: Current Accounts
  // ═══════════════════════════════════════════════════════════════

  const userColumns = [
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <Space size={10} align="center">
          <UserAvatar
            src={record.avatarUrl}
            name={record.name}
            size={32}
            style={{ flex: "none" }}
          />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600 }}>{record.name || "-"}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {record.username ? `@${record.username}` : ""}
              {record.email ? (record.username ? " • " : "") + record.email : ""}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "userType",
      key: "userType",
      width: 140,
      render: (v) => {
        const role = v || "guest";
        const colorMap = {
          developer: "purple",
          administrator: "gold",
          "co-admin": "blue",
          guest: "default",
        };
        return (
          <Tag icon={<SafetyOutlined />} color={colorMap[role] || "default"} style={{ textTransform: "capitalize" }}>
            {role}
          </Tag>
        );
      },
    },
    {
      title: "Access",
      key: "access",
      render: (_, record) => renderAccessIcons(record),
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Button type="primary" icon={<SafetyOutlined />} onClick={() => showModal(record)} size="small">
          Manage Access
        </Button>
      ),
    },
  ];

  const renderPermItem = (perm) => {
    const enabled = Boolean(selectedUser?.[perm.key]);
    const icon = permIcons[perm.key] || <SettingOutlined />;

    return (
      <List.Item
        actions={[
          <Badge
            key={`${perm.key}-badge`}
            status={enabled ? "success" : "default"}
            text={<StatusTag enabled={enabled} />}
          />,
          <Switch
            key={`${perm.key}-switch`}
            checked={enabled}
            onChange={(val) => handleToggle(selectedUser._id, perm.key, val)}
          />,
        ]}
      >
        <List.Item.Meta
          avatar={<Avatar shape="square" size={28} icon={icon} />}
          title={perm.label}
          description={perm.description}
        />
      </List.Item>
    );
  };

  const allPermissionKeys = useMemo(() => {
    const keys = [];
    (accessGroups || []).forEach((g) => {
      (g.permissions || []).forEach((p) => keys.push(p.key));
    });
    (dangerZone.permissions || []).forEach((p) => keys.push(p.key));
    return Array.from(new Set(keys));
  }, []);

  const accessSummary = useMemo(() => {
    const total = allPermissionKeys.length;
    const enabled = allPermissionKeys.reduce((acc, k) => acc + (selectedUser?.[k] ? 1 : 0), 0);
    return { enabled, total };
  }, [allPermissionKeys, selectedUser]);

  const renderCurrentAccountsTab = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <Input
          size="small"
          placeholder="Search users..."
          prefix={<SearchOutlined />}
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          allowClear
          style={{ width: 240 }}
        />
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>{filteredUsers.length} accounts</Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchUsers} loading={loadingUsers}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filteredUsers}
        columns={userColumns}
        rowKey="_id"
        size="small"
        bordered
        loading={loadingUsers}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50] }}
      />
    </>
  );

  // ═══════════════════════════════════════════════════════════════
  // TAB 2: Signup Requests
  // ═══════════════════════════════════════════════════════════════

  const approvalStatusColor = (status) => {
    switch (status) {
      case "approved": return "green";
      case "rejected": return "red";
      case "pending":
      default: return "orange";
    }
  };

  const signupColumns = [
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <Space size={10} align="center">
          <UserAvatar
            src={record.avatarUrl}
            name={record.name}
            size={32}
            style={{ flex: "none" }}
          />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600 }}>{record.name || "-"}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              @{record.username || "-"} • {record.email || "-"}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Signed Up",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      defaultSortOrder: "descend",
      render: (v) => {
        const d = dayjs(v);
        return d.isValid() ? d.format("MMM DD, YYYY hh:mm A") : "-";
      },
    },
    {
      title: "Verified",
      dataIndex: "isVerified",
      key: "isVerified",
      width: 100,
      render: (v) => (
        <Tag
          icon={v ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={v ? "green" : "default"}
        >
          {v ? "Yes" : "No"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 110,
      render: (v) => {
        const status = v || "pending";
        return (
          <Tag color={approvalStatusColor(status)} style={{ textTransform: "capitalize" }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_, record) => {
        const status = record.approvalStatus || "pending";
        return (
          <Space size={4}>
            {status === "pending" && (
              <>
                <Popconfirm
                  title="Approve this account?"
                  description={`${record.name} will receive an email and can log in.`}
                  onConfirm={() => handleApprove(record._id)}
                  okText="Approve"
                  cancelText="Cancel"
                >
                  <Button type="primary" size="small" icon={<CheckOutlined />}>
                    Approve
                  </Button>
                </Popconfirm>
                <Button size="small" danger icon={<StopOutlined />} onClick={() => handleRejectClick(record)}>
                  Reject
                </Button>
              </>
            )}
            {status === "rejected" && (
              <Popconfirm
                title="Approve this previously rejected account?"
                onConfirm={() => handleApprove(record._id)}
                okText="Approve"
                cancelText="Cancel"
              >
                <Button type="primary" size="small" icon={<CheckOutlined />}>
                  Approve
                </Button>
              </Popconfirm>
            )}
            {status === "approved" && (
              <Tag color="green" icon={<CheckCircleOutlined />}>Approved</Tag>
            )}
            <Popconfirm
              title="Delete this account permanently?"
              description="This action cannot be undone."
              onConfirm={() => handleDeleteUser(record._id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const renderSignupRequestsTab = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <Space size={8}>
          <Input
            size="small"
            placeholder="Search signups..."
            prefix={<SearchOutlined />}
            value={signupSearch}
            onChange={(e) => setSignupSearch(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Select
            size="small"
            value={signupFilter}
            onChange={setSignupFilter}
            style={{ width: 130 }}
            options={[
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All Signups" },
            ]}
          />
        </Space>
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>{filteredSignups.length} signups</Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchSignups} loading={loadingSignups}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filteredSignups}
        columns={signupColumns}
        rowKey="_id"
        size="small"
        bordered
        loading={loadingSignups}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50] }}
        expandable={{
          expandedRowRender: (record) => {
            const status = record.approvalStatus || "pending";
            return (
              <div style={{ padding: "4px 8px", fontSize: 12 }}>
                {status === "rejected" && record.rejectionReason && (
                  <div style={{ marginBottom: 4 }}>
                    <Text type="danger" strong>Rejection Reason: </Text>
                    <Text>{record.rejectionReason}</Text>
                  </div>
                )}
                {status === "approved" && record.approvedAt && (
                  <div>
                    <Text type="success" strong>Approved: </Text>
                    <Text>{dayjs(record.approvedAt).format("MMM DD, YYYY hh:mm A")}</Text>
                  </div>
                )}
                {status === "rejected" && record.rejectedAt && (
                  <div>
                    <Text type="danger" strong>Rejected: </Text>
                    <Text>{dayjs(record.rejectedAt).format("MMM DD, YYYY hh:mm A")}</Text>
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">Designation: </Text>
                  <Text>{record.designation || "—"}</Text>
                  <Text type="secondary" style={{ marginLeft: 16 }}>Position: </Text>
                  <Text>{record.position || "—"}</Text>
                </div>
              </div>
            );
          },
          rowExpandable: (record) =>
            (record.approvalStatus === "rejected" && record.rejectionReason) ||
            record.approvalStatus === "approved" ||
            record.designation ||
            record.position,
        }}
      />
    </>
  );

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <Card
      style={{ margin: "10px", borderRadius: 12 }}
      title={
        <Space size={8} align="center">
          <TeamOutlined />
          <span>User Accounts</span>
        </Space>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "accounts",
            label: (
              <Space size={6}>
                <UserOutlined />
                <span>Current Accounts</span>
              </Space>
            ),
            children: renderCurrentAccountsTab(),
          },
          {
            key: "signups",
            label: (
              <Badge count={pendingCount} size="small" offset={[8, 0]}>
                <Space size={6}>
                  <UserAddOutlined />
                  <span>Signup Requests</span>
                </Space>
              </Badge>
            ),
            children: renderSignupRequestsTab(),
          },
        ]}
      />

      {/* ── Access Control Modal ────────────────────────────────── */}
      {selectedUser && (
        <Modal
          title={
            <Space size={10} align="center">
              <Avatar icon={<UserOutlined />} />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600 }}>Access Control</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{selectedUser.name}</div>
              </div>
              {selectedUser.isVerified && <Tag color="green">Verified</Tag>}
            </Space>
          }
          open={isModalVisible}
          onCancel={handleCancel}
          footer={[
            <Button key="back" onClick={handleCancel}>
              Close
            </Button>,
          ]}
          width={700}
          style={{ top: 40 }}
        >
          <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label={<Space size={6}><IdcardOutlined />Username</Space>}>
              {selectedUser.username || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={<Space size={6}><MailOutlined />Email</Space>}>
              {selectedUser.email || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={<Space size={6}><SafetyOutlined />Role</Space>}>
              {selectedUser.userType || "guest"}
            </Descriptions.Item>
            <Descriptions.Item label={<Space size={6}><DashboardOutlined />Access Summary</Space>}>
              <Space size={8} wrap>
                <Tag icon={<CheckCircleOutlined />} color="green" style={{ marginInlineEnd: 0 }}>
                  Enabled: {accessSummary.enabled}
                </Tag>
                <Tag style={{ marginInlineEnd: 0 }}>
                  Total: {accessSummary.total}
                </Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <Collapse defaultActiveKey={["general"]} bordered={false}>
            {accessGroups.map((group) => (
              <Panel
                header={
                  <Space size={8} align="center">
                    {groupIcons[group.key] || <SettingOutlined />}
                    <span>{group.title}</span>
                  </Space>
                }
                key={group.key}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={group.permissions}
                  renderItem={renderPermItem}
                />
              </Panel>
            ))}

            {/* Danger Zone */}
            <Panel
              header={
                <Space size={8} align="center">
                  {groupIcons.danger}
                  <Text strong type="danger">
                    {dangerZone.title}
                  </Text>
                </Space>
              }
              key={dangerZone.key}
            >
              <List
                itemLayout="horizontal"
                dataSource={dangerZone.permissions}
                renderItem={renderPermItem}
              />
              <div style={{ marginTop: 16 }}>
                <Text strong>User Hierarchy</Text>
                <br />
                <Radio.Group
                  value={selectedUser.userType || "guest"}
                  onChange={(e) =>
                    handleToggle(selectedUser._id, "userType", e.target.value)
                  }
                  style={{ marginTop: 8 }}
                >
                  <Radio value="developer">Developer</Radio>
                  <Radio value="administrator">Administrator</Radio>
                  <Radio value="co-admin">Co-Admin</Radio>
                  <Radio value="guest">Guest User</Radio>
                </Radio.Group>
              </div>
            </Panel>
          </Collapse>
        </Modal>
      )}

      {/* ── Rejection Reason Modal ──────────────────────────────── */}
      <Modal
        title="Reject Account Registration"
        open={rejectModalVisible}
        onOk={handleRejectConfirm}
        onCancel={() => { setRejectModalVisible(false); setRejectTarget(null); }}
        okText="Reject"
        okButtonProps={{ danger: true }}
        width={480}
      >
        {rejectTarget && (
          <div style={{ marginBottom: 12 }}>
            <Text>Rejecting account for <Text strong>{rejectTarget.name}</Text> ({rejectTarget.email})</Text>
          </div>
        )}
        <Input.TextArea
          rows={3}
          placeholder="Reason for rejection (optional, will be sent via email)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </Card>
  );
};

export default UserAccess;
