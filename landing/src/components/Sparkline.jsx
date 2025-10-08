import React from "react";

const Sparkline = ({ data = [], width = 220, height = 60, stroke = "#52c41a", fill = "rgba(82,196,26,0.15)" }) => {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const norm = (v) => (max === min ? 0.5 : (v - min) / (max - min));

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 8) + 4; // padding 4
    const y = height - (norm(v) * (height - 8) + 4);
    return [x, y];
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1][0]},${height - 2} L ${points[0][0]},${height - 2} Z`;

  return (
    <svg width={width} height={height} role="img" aria-label="sparkline">
      <path d={areaD} fill={fill} stroke="none" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export default Sparkline;
