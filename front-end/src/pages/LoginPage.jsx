import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Card, message } from 'antd';
import { login } from '../api/authAPI';
import { secureStore } from '../utils/secureStorage';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const data = await login(values);
      secureStore('token', data.token);
      message.success('Login successful!');
      navigate('/');
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <Card title={<Title level={3}>Admin Login</Title>} style={{ width: 400 }}>
        <Form name="login" onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input placeholder="Enter username" />
          </Form.Item>

          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password placeholder="Enter password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Log in
            </Button>
          </Form.Item>
        </Form>

        {/* Link to Sign Up */}
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Text type="secondary">Don’t have an account?</Text>{' '}
          <Link to="/signup">Register here</Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
