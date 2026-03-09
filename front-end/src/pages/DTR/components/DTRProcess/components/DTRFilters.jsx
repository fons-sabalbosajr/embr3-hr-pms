import React from "react";
import { Select, Input, Space, Grid, Modal } from "antd";
const { Search } = Input;
const { useBreakpoint } = Grid;

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
  dtrLogsLoading,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Multi-select handler — validates date ranges are the same
  const handleRecordChange = (values) => {
    if (!values || values.length <= 1) {
      setSelectedDtrRecord(values || []);
      return;
    }
    // Validate all selected records share the same date range
    const selectedRecords = values.map((name) =>
      dtrRecords.find((r) => r.DTR_Record_Name === name)
    ).filter(Boolean);

    if (selectedRecords.length < 2) {
      setSelectedDtrRecord(values);
      return;
    }

    const normalize = (d) => {
      if (!d) return "";
      return new Date(d).toISOString().split("T")[0];
    };

    const firstStart = normalize(selectedRecords[0]?.DTR_Cut_Off?.start);
    const firstEnd = normalize(selectedRecords[0]?.DTR_Cut_Off?.end);

    const allSameRange = selectedRecords.every((rec) => {
      const s = normalize(rec?.DTR_Cut_Off?.start);
      const e = normalize(rec?.DTR_Cut_Off?.end);
      return s === firstStart && e === firstEnd;
    });

    if (!allSameRange) {
      Modal.warning({
        title: "Cannot merge biometric data",
        content:
          "The selected biometric records have different date ranges. You can only multi-select records with the same cut-off period to merge their time records.",
        okText: "OK",
      });
      return;
    }

    setSelectedDtrRecord(values);
  };

  return (
  <Space wrap>
    <Select
      placeholder="Select biometrics cut off"
      style={{ width: isMobile ? '100%' : 280 }}
      mode="multiple"
      maxTagCount={2}
      maxTagTextLength={16}
      value={selectedDtrRecord}
      onChange={handleRecordChange}
      loading={dtrLogsLoading}
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
      style={{ width: isMobile ? '100%' : 200 }}
      value={searchText}
    />
    <Select
      placeholder="Filter by Employee Type"
      allowClear
      options={empTypeOptions}
      style={{ width: isMobile ? '100%' : 150 }}
      onChange={(value) => setEmpTypeFilter(value || "")}
      value={empTypeFilter}
    />
    <Search
      placeholder="Filter by Section/Unit"
      allowClear
      onSearch={setSectionOrUnitFilter}
      onChange={(e) => setSectionOrUnitFilter(e.target.value)}
      style={{ width: isMobile ? '100%' : 200 }}
      value={sectionOrUnitFilter}
    />
  </Space>
  );
};

export default DTRFilters;