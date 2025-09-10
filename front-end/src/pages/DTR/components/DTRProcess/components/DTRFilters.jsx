import React from "react";
import { Select, Input, Space } from "antd";
const { Search } = Input;

const DTRFilters = ({
  selectedDtrRecord,
  setSelectedDtrRecord,
  dtrRecords,
  searchText,
  setSearchText,
  empTypeFilter,
  setEmpTypeFilter,
  empTypeOptions,
  sectionOrUnitFilter,
  setSectionOrUnitFilter,
}) => (
  <Space style={{ marginBottom: 16 }} wrap>
    <Select
      placeholder="Select a biometrics cut off"
      style={{ width: 180 }}
      value={selectedDtrRecord}
      onChange={setSelectedDtrRecord}
      options={dtrRecords.map((rec) => ({
        label: rec.DTR_Record_Name,
        value: rec.DTR_Record_Name,
      }))}
      allowClear
    />
    <Search
      placeholder="Search by name, empNo, empId"
      allowClear
      onSearch={setSearchText}
      onChange={(e) => setSearchText(e.target.value)}
      style={{ width: 200 }}
      value={searchText}
    />
    <Select
      placeholder="Filter by Employee Type"
      allowClear
      options={empTypeOptions}
      style={{ width: 150 }}
      onChange={(value) => setEmpTypeFilter(value || "")}
      value={empTypeFilter}
    />
    <Search
      placeholder="Filter by Section/Unit"
      allowClear
      onSearch={setSectionOrUnitFilter}
      onChange={(e) => setSectionOrUnitFilter(e.target.value)}
      style={{ width: 200 }}
      value={sectionOrUnitFilter}
    />
  </Space>
);

export default DTRFilters;