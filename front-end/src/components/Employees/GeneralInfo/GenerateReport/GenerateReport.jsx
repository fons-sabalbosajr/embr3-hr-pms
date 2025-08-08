import React from 'react';
import { Button, Space, Typography, message } from 'antd';

const { Text } = Typography;

const GenerateReport = ({ employee, onClose }) => {
  const handleGenerate = async () => {
    try {
      // TODO: Replace this with your actual report generation logic
      console.log('Generating report for:', employee);

      // Simulate success response
      message.success(`Report generated for ${employee.name}`);
      onClose();
    } catch (error) {
      console.error('Report generation failed:', error);
      message.error('Failed to generate report');
    }
  };

  return (
    <div>
      <Text>
        Generate a report for <strong>{employee.name}</strong> (Employee No.{' '}
        {employee.empNo})?
      </Text>

      <Space style={{ marginTop: 20 }}>
        <Button type="primary" onClick={handleGenerate}>
          Generate Report
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </Space>
    </div>
  );
};

export default GenerateReport;
