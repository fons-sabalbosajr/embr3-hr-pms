import React from "react";
import { Result, Button, Typography } from "antd";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
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

  render() {
    if (this.state.hasError) {
      return (
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
            subTitle="An unexpected error occurred while rendering this section. You can try reloading the page. If the problem persists, please report it from the Demo mode bug report button."
            extra={
              <Button type="primary" onClick={this.handleReload}>
                Reload
              </Button>
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
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
