import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Space, Button, Form, Input, Divider, Alert } from 'antd';
import { listSecureKeys, listSecureSessionKeys, rotateSecureStorage } from '../../../../utils/secureStorage';

const { Title, Text } = Typography;

const columns = [
  { title: 'Key', dataIndex: 'key', key: 'key', ellipsis: true },
  { title: 'Encrypted', dataIndex: 'encrypted', key: 'encrypted', render: (v) => (v ? 'Yes' : 'No') },
];

export default function SecureStorageDiagnostics() {
  const [localKeys, setLocalKeys] = useState([]);
  const [sessionKeys, setSessionKeys] = useState([]);
  const [rotating, setRotating] = useState(false);
  const [result, setResult] = useState(null);

  const load = () => {
    try {
      setLocalKeys(listSecureKeys());
      setSessionKeys(listSecureSessionKeys());
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRotate = async (values) => {
    setRotating(true);
    setResult(null);
    try {
      const { oldSecret, newSecret } = values || {};
      if (!oldSecret || !newSecret) return;
      const res = rotateSecureStorage(oldSecret, newSecret);
      setResult(res);
      load();
    } catch (e) {
      setResult({ error: e?.message || 'Failed to rotate' });
    } finally {
      setRotating(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Title level={4}>Secure Storage Diagnostics</Title>
      <Text type="secondary">Admin-only: inspect which keys are encrypted and perform client-side key rotation.</Text>

      <Card size="small" title="LocalStorage Keys">
        <Table
          className="compact-table"
          size="small"
          rowKey={(r) => r.key}
          columns={columns}
          dataSource={localKeys}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: [5,8,10,20,50] }}
        />
      </Card>

      <Card size="small" title="SessionStorage Keys">
        <Table
          className="compact-table"
          size="small"
          rowKey={(r) => r.key}
          columns={columns}
          dataSource={sessionKeys}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: [5,8,10,20,50] }}
        />
      </Card>

      <Card size="small" title="Key Rotation (Advanced)">
        <Alert
          type="warning"
          showIcon
          message="Rotate carefully"
          description="Rotation decrypts entries with the old secret and re-encrypts with the new secret in this browser only. Ensure deployment and environment variables are coordinated across users/devices before rotating."
          style={{ marginBottom: 12 }}
        />
        <Form layout="inline" onFinish={onRotate}>
          <Form.Item name="oldSecret" label="Old Secret" rules={[{ required: true }]}> 
            <Input.Password placeholder="Old VITE_ENCRYPT_SECRET" style={{ width: 320 }} />
          </Form.Item>
          <Form.Item name="newSecret" label="New Secret" rules={[{ required: true }]}> 
            <Input.Password placeholder="New VITE_ENCRYPT_SECRET" style={{ width: 320 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={rotating}>Rotate</Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={load}>Refresh</Button>
          </Form.Item>
        </Form>
        {result && (
          <div style={{ marginTop: 12 }}>
            {result.error ? (
              <Alert type="error" showIcon message={result.error} />
            ) : (
              <Alert type="success" showIcon message={`Re-encrypted: local=${result.updatedLocal} session=${result.updatedSession}`} />
            )}
          </div>
        )}
      </Card>
    </Space>
  );
}
