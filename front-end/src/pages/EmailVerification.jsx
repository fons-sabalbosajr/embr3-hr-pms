// src/pages/EmailVerification.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { message, Spin, Result, Button } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import axios from "../api/axiosInstance";

const EmailVerification = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'

  useEffect(() => {
    let isMounted = true;

    const verifyEmail = async () => {
      try {
        const res = await axios.get(`/users/verify/${token}`);
        if (isMounted) {
          setStatus("success");
          message.success("Email verified successfully!");
          setTimeout(() => {
            navigate("/auth?verified=true");
          }, 3000);
        }
      } catch (err) {
        if (isMounted) {
          setStatus("error");
          message.error("Invalid or expired verification link.");
          setTimeout(() => {
            navigate("/auth");
          }, 3000);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyEmail();

    return () => {
      isMounted = false;
    };
  }, [token, navigate]);

  const renderResult = () => {
    if (status === "success") {
      return (
        <Result
          status="success"
          title="Email Verified!"
          subTitle="You will be redirected shortly to the login page."
          icon={<CheckCircleOutlined />}
        />
      );
    }

    if (status === "error") {
      return (
        <Result
          status="error"
          title="Verification Failed"
          subTitle="The verification link is invalid or expired. Redirecting..."
          icon={<CloseCircleOutlined />}
          extra={[
            <Button type="primary" onClick={() => navigate("/auth")} key="auth">
              Go to Login
            </Button>,
            <Button danger onClick={() => navigate("/auth?resend=true")}>
              Resend Verification Email
            </Button>,
          ]}
        />
      );
    }

    return null;
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#f0f2f5",
      }}
    >
      {loading ? (
        <Spin size="large" tip="Verifying email..." />
      ) : (
        renderResult()
      )}
    </div>
  );
};

export default EmailVerification;
