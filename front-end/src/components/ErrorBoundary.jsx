import React from "react";
import { Result, Button, Typography, Modal, Form, Input, message } from "antd";
import axiosInstance from "../api/axiosInstance";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reportOpen: false, submitting: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log error; could send to monitoring endpoint
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // Optionally force reload
    window.location.reload();
  };

  openReport = () => {
    this.setState({ reportOpen: true });
  };

  closeReport = () => {
    this.setState({ reportOpen: false });
  };

  submitReport = async (values) => {
    try {
      this.setState({ submitting: true });
      const payload = {
        title: values.title,
        description: values.description,
        pageUrl: window.location?.href,
        userAgent: navigator?.userAgent,
        email: values.email || undefined,
        name: values.name || undefined,
      };
      await axiosInstance.post(`/bug-report`, payload);
      message.success("Bug report sent. Thank you!");
      this.setState({ reportOpen: false, submitting: false });
    } catch (e) {
      message.error(e?.response?.data?.message || "Failed to send bug report.");
      this.setState({ submitting: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <>
        <div
          style={{
            padding: 24,
            maxWidth: 720,
            margin: "40px auto",
            background: "var(--app-surface-bg)",
            color: "var(--app-text-color)",
            border: "1px solid var(--app-border-color)",
            borderRadius: 8,
          }}
        >
          <Result
            status="error"
            title="Something went wrong"
            subTitle="An unexpected error occurred while rendering this section. You can try reloading the page. If the problem persists, please report it so we can investigate."
            extra={
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button onClick={this.openReport}>Report Bug</Button>
                <Button type="primary" onClick={this.handleReload}>Reload</Button>
              </div>
            }
          />
          {this.state.error && (
            <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
              <Typography.Text type="secondary">Details</Typography.Text>
              <pre
                style={{
                  background: "var(--app-surface-hover-bg)",
                  color: "var(--app-text-muted)",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid var(--app-border-color)",
                  overflowX: "auto",
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                {String(this.state.error?.message || this.state.error)}
              </pre>
            </Typography.Paragraph>
          )}
        </div>
        <BugReportModal
          open={this.state.reportOpen}
          submitting={this.state.submitting}
          onCancel={this.closeReport}
          onSubmit={this.submitReport}
          error={this.state.error}
        />
        </>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

function BugReportModal({ open, onCancel, onSubmit, submitting, error }) {
  const [form] = Form.useForm();
  const defaultDesc = [
    `Page: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    `UserAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    error ? `Error: ${String(error?.message || error)}` : '',
  ].filter(Boolean).join('\n');

  return (
    <Modal
      open={open}
      title="Report a Bug"
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={submitting ? 'Sending…' : 'Send Report'}
      okButtonProps={{ loading: submitting }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ description: defaultDesc }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a brief title' }]}>
          <Input placeholder="Short summary (e.g., Error opening DTR modal)" maxLength={180} showCount />
        </Form.Item>
        <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Please describe what happened' }]}>
          <Input.TextArea rows={5} placeholder="What were you doing? Steps to reproduce?" />
        </Form.Item>
        <Form.Item name="name" label="Your Name (optional)">
          <Input placeholder="Juan Dela Cruz" />
        </Form.Item>
        <Form.Item name="email" label="Your Email (optional)">
          <Input type="email" placeholder="you@example.com" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
