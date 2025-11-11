import React, { useEffect, useState } from "react";
import { Table, Spin, Alert, Tag, Card, Modal } from "antd";
import dayjs from "dayjs";
import axiosInstance from "../../../../../api/axiosInstance";

const divisionColors = {
  "Clearance and Permitting Division": "#1f9cca",
  "Finance and Administrative Division": "#283539",
  "Environmental Monitoring and Enforcement Division": "#009d8c",
  "Office of the Regional Director": "#cb330e",
  "Specialized Team": "#fd8004",
};

const Trainings = ({ employee }) => {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  useEffect(() => {
    if (!employee?.empId) return;

    const fetchTrainings = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          `/trainings/by-employee/${employee.empId}`
        );
        setTrainings(res.data.data || []);
      } catch (err) {
        setError(err.message || "Failed to fetch trainings");
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, [employee?.empId]);

  // Prepare a participant lookup for modal
  const participantTrainingsMap = {};
  trainings.forEach((t) => {
    t.participants?.forEach((p) => {
      if (!participantTrainingsMap[p.empId])
        participantTrainingsMap[p.empId] = [];
      participantTrainingsMap[p.empId].push(t);
    });
  });

  const columns = [
    {
      title: "Training Info",
      key: "info",
      width: "60%",
      render: (_, record) => (
        <div style={{ lineHeight: 1.5 }}>
          <div>
            <strong>Name:</strong> {record.name}
          </div>
          <div>
            <strong>Host:</strong> {record.host}
          </div>
          <div>
            <strong>Venue:</strong> {record.venue || "TBA"}
          </div>
          <div>
            <strong>Date:</strong>{" "}
            {record.trainingDate?.length >= 2
              ? `${dayjs(record.trainingDate[0]).format(
                  "MMM D, YYYY"
                )} - ${dayjs(record.trainingDate[1]).format("MMM D, YYYY")}`
              : "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Participants",
      key: "participants",
      width: "40%",
      render: (_, record) => (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2px",
            maxHeight: "80px",
            overflowY: "auto",
          }}
        >
          {record.participants
            ?.sort((a, b) => {
              const colorA = divisionColors[a.division] || "#ccc";
              const colorB = divisionColors[b.division] || "#ccc";
              return colorA.localeCompare(colorB);
            })
            .map((p) => {
              const isResigned = !!p.resigned;
              const baseColor = divisionColors[p.division] || "#ccc";
              const style = {
                cursor: isResigned ? "not-allowed" : "pointer",
                fontSize: 10,
                opacity: isResigned ? 0.5 : 1,
                textDecoration: isResigned ? "line-through" : undefined,
                borderStyle: isResigned ? "dashed" : undefined,
              };
              const handleClick = () => {
                if (isResigned) return; // disabled
                setSelectedParticipant({
                  ...p,
                  trainings: participantTrainingsMap[p.empId],
                });
              };
              return (
                <Tag
                  key={p.empId}
                  color={baseColor}
                  style={style}
                  onClick={handleClick}
                  title={isResigned ? "Resigned" : undefined}
                >
                  {p.name}
                </Tag>
              );
            })}
        </div>
      ),
    },
  ];

  if (loading) return <Spin size="large" style={{ margin: "20px" }} />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div>
      <Table
        columns={columns}
        dataSource={trainings}
        rowKey={(record) => record._id}
        pagination={{ pageSize: 10 }}
        bordered
        size="small"
      />

      {/* Participant Modal */}
      <Modal
        title={selectedParticipant?.name}
        open={!!selectedParticipant}
        onCancel={() => setSelectedParticipant(null)}
        footer={null}
        width={600}
      >
        {selectedParticipant && (
          <div style={{ lineHeight: 1.5, fontSize: 14 }}>
            <p>
              <strong>Name:</strong> {selectedParticipant.name}
            </p>
            <p>
              <strong>Division:</strong> {selectedParticipant.division}
            </p>
            <p>
              <strong>Section/Unit:</strong>{" "}
              {selectedParticipant.sectionOrUnit || "-"}
            </p>
            <p>
              <strong>Employee ID:</strong> {selectedParticipant.empId}
            </p>

            <p>
              <strong>Trainings:</strong>
            </p>
            <ul>
              {selectedParticipant.trainings?.map((t) => (
                <li key={t._id}>
                  {t.name} ({dayjs(t.trainingDate[0]).format("MMM D")} -{" "}
                  {dayjs(t.trainingDate[1]).format("MMM D, YYYY")})
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Trainings;
