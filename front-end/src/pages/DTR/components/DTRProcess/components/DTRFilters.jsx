import React, { useMemo } from "react";
import { Select, Input, Space, Grid, Modal, DatePicker } from "antd";
import dayjs from "dayjs";
const { Search } = Input;
const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;

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
  sectionOrUnitOptions,
  dtrLogsLoading,
  dateRangeFilter,
  setDateRangeFilter,
  selectedRecord,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Resolve a dropdown value to an effective record with date range
  const resolveValue = (val) => {
    if (!val) return null;
    if (val.includes("||")) {
      const [containerName, childStart, childEnd] = val.split("||");
      const parent = dtrRecords.find((r) => r.DTR_Record_Name === containerName);
      if (!parent) return null;
      return { ...parent, DTR_Cut_Off: { start: childStart, end: childEnd } };
    }
    return dtrRecords.find((r) => r.DTR_Record_Name === val) || null;
  };

  // Multi-select handler — validates date ranges are the same
  const handleRecordChange = (values) => {
    if (!values || values.length <= 1) {
      setSelectedDtrRecord(values || []);
      return;
    }
    // Validate all selected records share the same date range
    const selectedRecords = values.map((v) => resolveValue(v)).filter(Boolean);

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

  // Build dropdown options: containers show their child periods as sub-options
  const dtrOptions = useMemo(() => {
    const sorted = [...dtrRecords].sort((a, b) => {
      const aStart = a.DTR_Cut_Off?.start ? new Date(a.DTR_Cut_Off.start).getTime() : 0;
      const bStart = b.DTR_Cut_Off?.start ? new Date(b.DTR_Cut_Off.start).getTime() : 0;
      return bStart - aStart;
    });

    const opts = [];
    sorted.forEach((rec) => {
      const isContainer = rec.isContainer || rec.childPeriods?.length;
      // Containers: hidden unless explicitly set to visible
      if (isContainer && rec.hiddenFromDropdown !== false) return;
      // Non-containers: visible unless explicitly set to hidden
      if (!isContainer && rec.hiddenFromDropdown === true) return;
      opts.push({ label: rec.DTR_Record_Name, value: rec.DTR_Record_Name });
    });
    return opts;
  }, [dtrRecords]);

  return (
  <Space wrap>
    <Select
      placeholder="Select biometrics cut off"
      style={{ width: isMobile ? '100%' : 380 }}
      mode="multiple"
      maxTagCount={2}
      maxTagTextLength={20}
      value={selectedDtrRecord}
      onChange={handleRecordChange}
      loading={dtrLogsLoading}
      options={dtrOptions}
      allowClear
    />
    <RangePicker
      size="middle"
      style={{ width: isMobile ? '100%' : 240 }}
      value={dateRangeFilter}
      onChange={(dates) => setDateRangeFilter(dates)}
      allowClear
      disabled={!selectedRecord}
      placeholder={['Start Date', 'End Date']}
      disabledDate={(current) => {
        if (!selectedRecord?.DTR_Cut_Off) return false;
        const start = dayjs(selectedRecord.DTR_Cut_Off.start).startOf('day');
        const end = dayjs(selectedRecord.DTR_Cut_Off.end).endOf('day');
        return current.isBefore(start, 'day') || current.isAfter(end, 'day');
      }}
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
    <Select
      placeholder="Filter by Section/Unit"
      allowClear
      showSearch
      options={sectionOrUnitOptions || []}
      style={{ width: isMobile ? '100%' : 200 }}
      onChange={(value) => setSectionOrUnitFilter(value || "")}
      value={sectionOrUnitFilter || undefined}
      filterOption={(input, opt) => (opt?.label || "").toLowerCase().includes(input.toLowerCase())}
    />
  </Space>
  );
};

export default DTRFilters;