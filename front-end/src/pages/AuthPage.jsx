import { useState } from 'react';
import { Tabs, Form, Input, Button, Typography, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { secureStore } from '../utils/secureStorage';

const { Title, Text } = Typography;

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('login');
  const navigate = useNavigate();

  // --- Login handler
  const onLogin = async (values) => {
    try {
      setLoading(true);
      const res = await axios.post('/users/login', values);
      secureStore('token', res.data.token);
      message.success('Login successful');
      navigate('/');
    } catch (err) {
      message.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Signup handler
  const onSignup = async (values) => {
    if (values.password !== values.confirmPassword) {
      return message.error('Passwords do not match');
    }
    try {
      setLoading(true);
      const { confirmPassword, ...userData } = values;
      const res = await axios.post('/users/register', userData);
      message.success('Verification email sent. Check your inbox.');
      setTab('login');
    } catch (err) {
      message.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Resend Verification
  const handleResend = async (email) => {
    try {
      await axios.post('/users/resend-verification', { email });
      message.success('Verification email resent.');
    } catch (err) {
      message.error(err.response?.data?.message || 'Resend failed');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <Card style={{ width: 450 }}>
        <Title level={3} style={{ textAlign: 'center' }}>
          Admin Access
        </Title>

        <Tabs activeKey={tab} onChange={(key) => setTab(key)} centered>
          <Tabs.TabPane tab="Login" key="login">
            <Form layout="vertical" onFinish={onLogin}>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input placeholder="Enter username" />
              </Form.Item>

              <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                <Input.Password placeholder="Enter password" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  Log in
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'right' }}>
                <Button type="link" onClick={() => message.info('Feature not implemented yet')}>
                  Forgot Password?
                </Button>
              </div>
            </Form>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Sign Up" key="signup">
            <Form layout="vertical" onFinish={onSignup}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="designation" label="Designation" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="position" label="Position" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject('Passwords do not match');
                    },
                  }),
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  Register
                </Button>
              </Form.Item>

              {/* 🔁 Resend verification */}
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">Didn’t receive verification?</Text>{' '}
                <Button type="link" onClick={() => {
                  const email = document.querySelector('input[name="email"]').value;
                  if (email) {
                    handleResend(email);
                  } else {
                    message.warning('Enter email first');
                  }
                }}>
                  Resend Email
                </Button>
              </div>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default AuthPage;
