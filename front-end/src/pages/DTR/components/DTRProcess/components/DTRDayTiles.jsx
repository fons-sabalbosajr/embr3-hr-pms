import React from "react";
import { Popover, Tag } from "antd";
import { CalendarFilled, BookFilled } from "@ant-design/icons";
import dayjs from "dayjs";

const DTRDayTiles = ({
  days,
  emp,
  selectedRecord,
  holidaysPH,
  getEmployeeDayLogs,
  getTrainingDetailsOnDay,
  divisionColors,
  divisionAcronyms,
}) => {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
      {days.map((dayNum) => {
        const dateObj = dayjs(selectedRecord.DTR_Cut_Off.start).date(dayNum);
        const dateKey = dateObj.format("YYYY-MM-DD");

        const dayLogs = getEmployeeDayLogs(emp, dateKey);
        const hasLogs = dayLogs && Object.values(dayLogs).some((v) => v);

        const dayOfWeek = dateObj.day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Check if holiday
        const holiday = holidaysPH.find((h) => h.date === dateKey);

        // Check if training
        const training = getTrainingDetailsOnDay(emp, dateKey);
        const isTrainingDay = !!training;

        const weekendBg = "#ffe6e6";
        const holidayBg = "#ffe066";
        const trainingBg = "#e6e6ff";
        const workedWeekendStyle = {
          border: "2px solid #fa541c",
          backgroundColor: "#fff2e8",
        };
        const holidayStyle = {
          border: "2px solid #faad14",
          backgroundColor: holidayBg,
        };
        const trainingStyle = {
          border: "2px solid #722ed1",
          backgroundColor: trainingBg,
        };

        const tileStyle = {
          width: 45,
          minHeight: 35,
          background: isTrainingDay
            ? trainingBg
            : holiday
            ? holidayBg
            : isWeekend
            ? weekendBg
            : hasLogs
            ? "#d6f5d6"
            : "#f1f1f1",
          border: "1px solid #d9d9d9",
          borderRadius: 4,
          padding: 4,
          fontSize: 10,
          color: "#000",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
          textAlign: "center",
          whiteSpace: "nowrap",
          fontWeight: hasLogs ? "600" : "normal",
          cursor: hasLogs ? "pointer" : "default",
          ...(isWeekend && hasLogs ? workedWeekendStyle : {}),
          ...(holiday ? holidayStyle : {}),
          ...(isTrainingDay ? trainingStyle : {}),
        };

        const popoverContent = (
          <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 350 }}>
            {holiday && (
              <div
                style={{
                  color: "#faad14",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CalendarFilled style={{ color: "#faad14" }} /> {holiday.name}
              </div>
            )}
            {isTrainingDay && (
              <div
                style={{
                  color: "#722ed1",
                  fontWeight: "bold",
                  marginBottom: 4,
                }}
              >
                <BookFilled style={{ color: "#722ed1", marginRight: 4 }} />
                {training.name}
                <div
                  style={{
                    fontWeight: "normal",
                    color: "#444",
                    marginTop: 2,
                  }}
                >
                  <div>
                    <strong>Host:</strong> {training.host}
                  </div>
                  <div>
                    <strong>Venue:</strong> {training.venue}
                  </div>
                  <div>
                    <strong>Date:</strong>{" "}
                    {dayjs(training.trainingDate[0]).format("MMM D, YYYY")} -{" "}
                    {dayjs(training.trainingDate[1]).format("MMM D, YYYY")}
                  </div>
                  <div>
                    <strong>Transaction:</strong> {training.iisTransaction}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong>Participants:</strong>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        maxHeight: 80,
                        overflowY: "auto",
                        paddingLeft: 2,
                      }}
                    >
                      {training.participants
                        ?.slice() // create a copy for sorting
                        .sort((a, b) => {
                          const colorA = divisionColors[a.division] || "";
                          const colorB = divisionColors[b.division] || "";
                          return colorA.localeCompare(colorB);
                        })
                        .map((p) => {
                          const divColor = divisionColors[p.division] || "#555";
                          const divAcronym =
                            divisionAcronyms[p.division] || p.division;
                          return (
                            <Tag
                              key={p.empId}
                              style={{
                                backgroundColor: divColor,
                                color: "#fff",
                                fontSize: 9,
                                marginBottom: 1,
                                border: "none",
                              }}
                            >
                              {p.name} ({divAcronym})
                            </Tag>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {dayLogs
              ? Object.entries(dayLogs)
                  .filter(
                    ([_, times]) =>
                      times && (Array.isArray(times) ? times.length > 0 : true)
                  )
                  .map(([label, times]) => {
                    const timesArr = Array.isArray(times) ? times : [times];

                    return (
                      <div key={label}>
                        <strong>{label}:</strong>{" "}
                        {timesArr
                          .slice()
                          .sort((a, b) =>
                            dayjs(a, "hh:mm A").isBefore(dayjs(b, "hh:mm A"))
                              ? -1
                              : 1
                          )
                          .join(", ")}
                        {timesArr.length > 1 && (
                          <span
                            style={{
                              fontSize: 8,
                              color: "#888",
                              marginLeft: 4,
                            }}
                          >
                            ({timesArr.length})
                          </span>
                        )}
                      </div>
                    );
                  })
              : !isTrainingDay && (
                  <div style={{ color: "#bbb", fontSize: 11 }}>No Data</div>
                )}
          </div>
        );

        return (
          <Popover
            key={dayNum}
            content={popoverContent}
            trigger="hover"
            placement="top"
          >
            <div style={tileStyle}>
              <div
                style={{ fontWeight: "bold", fontSize: 11, marginBottom: 4 }}
                title={`Day ${dayNum}`}
              >
                {dayNum}
                <div
                  style={{
                    fontWeight: "normal",
                    fontSize: 10,
                    color: "#555",
                  }}
                >
                  {dateObj.format("ddd")}
                </div>
                {holiday && (
                  <span style={{ fontSize: 8, color: "#faad14" }}>Holiday</span>
                )}
                {isTrainingDay && (
                  <span
                    style={{
                      fontSize: 8,
                      color: "#722ed1",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      display: "block",
                      maxWidth: 50,
                      marginTop: 2,
                      lineHeight: 1,
                    }}
                  >
                    {training.iisTransaction}
                  </span>
                )}
              </div>
            </div>
          </Popover>
        );
      })}
    </div>
  );
};

export default DTRDayTiles;
