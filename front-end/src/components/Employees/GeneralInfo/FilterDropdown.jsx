import { useState } from "react";
import { Select, Button } from "antd";

const FilterDropdown = ({ confirm, clearFilters, setSelectedKeys, data }) => {
  const [filters, setFilters] = useState({
    position: '',
    sectionOrUnit: '',
    division: ''
  });

  const uniquePositions = Array.from(new Set(data.map(item => item.position).filter(Boolean)));
  const uniqueSections = Array.from(new Set(data.map(item => item.sectionOrUnit).filter(s => s && s.trim())));
  const uniqueDivisions = Array.from(new Set(data.map(item => item.division).filter(d => d && d.trim())));

  const applyFilter = () => {
    setSelectedKeys([JSON.stringify(filters)]);
    confirm();
  };

  const resetFilter = () => {
    setFilters({ position: '', sectionOrUnit: '', division: '' });
    clearFilters();
  };

  return (
    <div style={{ padding: 8, width: 250 }}>
      <div style={{ marginBottom: 8 }}>
        <label><strong>Position</strong></label>
        <Select
          showSearch
          allowClear
          style={{ width: "100%" }}
          placeholder="Select Position"
          value={filters.position || undefined}
          onChange={(val) => setFilters({ ...filters, position: val })}
          options={uniquePositions.map(p => ({ value: p, label: p }))}
        />
      </div>

      {uniqueSections.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label><strong>Unit/Section</strong></label>
          <Select
            showSearch
            allowClear
            style={{ width: "100%" }}
            placeholder="Select Unit/Section"
            value={filters.sectionOrUnit || undefined}
            onChange={(val) => setFilters({ ...filters, sectionOrUnit: val })}
            options={uniqueSections.map(s => ({ value: s, label: s }))}
          />
        </div>
      )}

      {uniqueDivisions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label><strong>Division</strong></label>
          <Select
            showSearch
            allowClear
            style={{ width: "100%" }}
            placeholder="Select Division"
            value={filters.division || undefined}
            onChange={(val) => setFilters({ ...filters, division: val })}
            options={uniqueDivisions.map(d => ({ value: d, label: d }))}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={resetFilter} size="small">Reset</Button>
        <Button type="primary" onClick={applyFilter} size="small">Apply</Button>
      </div>
    </div>
  );
};

export default FilterDropdown;
