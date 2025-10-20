import React, { useEffect, useState } from 'react';
import { Tabs, Table, Button, Space, Modal, Form, Input, DatePicker, Select, message, Typography } from 'antd';
import dayjs from 'dayjs';
import axiosInstance from '../../api/axiosInstance';
import { fetchPhilippineHolidays } from '../../api/holidayPH';

const { RangePicker } = DatePicker;

const NationalHolidays = () => {
  const [year, setYear] = useState(dayjs().year());
  const [data, setData] = useState([]);
  useEffect(() => {
    (async () => {
      const res = await fetchPhilippineHolidays(year);
      setData(res.map((h, idx) => ({ key: idx, date: h.date, name: h.localName, type: h.type })));
    })();
  }, [year]);
  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <DatePicker picker="year" value={dayjs(String(year))} onChange={(d)=> setYear(d?.year()||dayjs().year())} />
      </Space>
      <Table size="small" pagination={false} dataSource={data} columns={[
        { title: 'Date', dataIndex: 'date', key: 'date', render: (d)=> dayjs(d).format('YYYY-MM-DD') },
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Type', dataIndex: 'type', key: 'type' },
      ]} />
    </div>
  );
};

const LocalHolidays = () => {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const { data } = await axiosInstance.get('/local-holidays');
    setList((data?.data||[]).map(d=>({ key: d._id, ...d })));
  };
  useEffect(()=>{ load(); }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      date: values.range ? values.range[0] : values.date,
      endDate: values.range ? values.range[1] : undefined,
      location: values.location,
      notes: values.notes,
    };
    await axiosInstance.post('/local-holidays', payload);
    message.success('Local holiday saved');
    setOpen(false); form.resetFields(); load();
  };

  const remove = async (record) => {
    await axiosInstance.delete(`/local-holidays/${record.key}`);
    message.success('Deleted');
    load();
  };

  return (
    <div>
      <Button type="primary" onClick={()=> setOpen(true)} style={{ marginBottom: 12 }}>Add Local Holiday</Button>
      <Table size="small" dataSource={list} rowKey="key" columns={[
        { title: 'Name', dataIndex: 'name' },
        { title: 'Date', dataIndex: 'date', render: (d, r)=> r.endDate ? `${dayjs(d).format('YYYY-MM-DD')} → ${dayjs(r.endDate).format('YYYY-MM-DD')}` : dayjs(d).format('YYYY-MM-DD') },
        { title: 'Location', dataIndex: 'location' },
        { title: 'Notes', dataIndex: 'notes' },
        { title: 'Action', key: 'action', render: (_, r)=> <Button danger size="small" onClick={()=> remove(r)}>Delete</Button> },
      ]} />

      <Modal open={open} onCancel={()=> setOpen(false)} onOk={onSubmit} title="Add Local Holiday">
        <Form layout="vertical" form={form}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Date Range" name="range" tooltip="Choose a range for multi-day holidays"><RangePicker /></Form.Item>
          <Form.Item label="Or Single Date" name="date"><DatePicker /></Form.Item>
          <Form.Item label="Location" name="location"><Input placeholder="e.g., EMBR3, Region, City" /></Form.Item>
          <Form.Item label="Notes" name="notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const { Title, Paragraph } = Typography;

const Suspensions = () => {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const { data } = await axiosInstance.get('/suspensions');
    setList((data?.data||[]).map(d=>({ key: d._id, ...d })));
  };
  useEffect(()=>{ load(); }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      title: values.title,
      date: values.range ? values.range[0] : values.date,
      endDate: values.range ? values.range[1] : undefined,
      scope: values.scope,
      location: values.location,
      referenceType: values.referenceType,
      referenceNo: values.referenceNo,
      notes: values.notes,
    };
    await axiosInstance.post('/suspensions', payload);
    message.success('Suspension saved');
    setOpen(false); form.resetFields(); load();
  };

  const remove = async (record) => {
    await axiosInstance.delete(`/suspensions/${record.key}`);
    message.success('Deleted');
    load();
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 8 }}>Suspension Days</Title>
      <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12 }}>
        Manage suspension days (temporary office closures or suspensions). Use the Add Suspension button to create a new suspension record; these entries will be used when calculating DTRs and reports.
      </Paragraph>
      <Button type="primary" onClick={()=> setOpen(true)} style={{ marginBottom: 12 }}>Add Suspension</Button>
      <Table size="small" dataSource={list} rowKey="key" columns={[
        { title: 'Title', dataIndex: 'title' },
        { title: 'Date', dataIndex: 'date', render: (d, r)=> r.endDate ? `${dayjs(d).format('YYYY-MM-DD')} → ${dayjs(r.endDate).format('YYYY-MM-DD')}` : dayjs(d).format('YYYY-MM-DD') },
        { title: 'Scope', dataIndex: 'scope' },
        { title: 'Reference', key: 'ref', render:(_, r)=> `${r.referenceType || ''} ${r.referenceNo || ''}` },
        { title: 'Location', dataIndex: 'location' },
        { title: 'Notes', dataIndex: 'notes' },
        { title: 'Action', key: 'action', render: (_, r)=> <Button danger size="small" onClick={()=> remove(r)}>Delete</Button> },
      ]} />

      <Modal open={open} onCancel={()=> setOpen(false)} onOk={onSubmit} title="Add Suspension Day">
        <Form layout="vertical" form={form}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Date Range" name="range"><RangePicker /></Form.Item>
          <Form.Item label="Or Single Date" name="date"><DatePicker /></Form.Item>
          <Form.Item label="Scope" name="scope" initialValue="Local"><Select options={[{value:'National'},{value:'Regional'},{value:'Local'}]} /></Form.Item>
          <Form.Item label="Location" name="location"><Input placeholder="e.g., EMBR3, Region, City" /></Form.Item>
          <Form.Item label="Reference Type" name="referenceType" initialValue="Memorandum"><Select options={[{value:'Memorandum'},{value:'Proclamation'},{value:'Order'},{value:'Other'}]} /></Form.Item>
          <Form.Item label="Reference No." name="referenceNo"><Input /></Form.Item>
          <Form.Item label="Notes" name="notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const Holidays = () => {
  return (
    <div>
      <Title level={3}>Holidays & Suspensions</Title>
      <Paragraph type="secondary">Configure national/local holidays and suspension days which affect timekeeping and payroll calculations.</Paragraph>
      <Tabs defaultActiveKey="1" items={[
      { key: '1', label: 'National Holidays', children: <NationalHolidays /> },
      { key: '2', label: 'Local Holidays', children: <LocalHolidays /> },
      { key: '3', label: 'Suspension Days', children: <Suspensions /> },
      ]} />
    </div>
  );
};

export default Holidays;
