import React from "react";
import { Popover, Tag, Spin } from "antd";
import { CalendarFilled, BookFilled, LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const DTRDayTiles = ({
  days,
  emp,
  selectedRecord,
  holidaysPH,
  getEmployeeDayLogs,
  getTrainingDetailsOnDay,
  divisionColors,
  divisionAcronyms,
  trainingLoading,
}) => {
  const loadingIndicator = (
    <LoadingOutlined style={{ fontSize: 10, color: "#8c8c8c" }} spin />
  );
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
      {days.map((dayNum) => {
        const dateObj = dayjs(selectedRecord.DTR_Cut_Off.start).date(dayNum);
        const dateKey = dateObj.format("YYYY-MM-DD");

        const dayLogs = getEmployeeDayLogs(emp, dateKey);
        const hasLogs = dayLogs && Object.values(dayLogs).some((v) => v);

        const dayOfWeek = dateObj.day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Check if holiday or suspension (supports ranges)
        const holiday = holidaysPH.find((h) => {
          if (!h) return false;
          const start = dayjs(h.date).format("YYYY-MM-DD");
          if (h.endDate) {
            const end = dayjs(h.endDate).format("YYYY-MM-DD");
            return (
              dayjs(dateKey).isSameOrAfter(start, "day") &&
              dayjs(dateKey).isSameOrBefore(end, "day")
            );
          }
          return start === dateKey;
        });

        // Check if training
        const training = getTrainingDetailsOnDay(emp, dateKey);
        const isTrainingDay = !!training;

        const weekendBg = "var(--dtr-weekend-bg, rgba(255,230,230,0.3))";
        const holidayBg = "var(--dtr-holiday-bg, rgba(250,173,20,0.18))";
        const trainingBg = "var(--dtr-training-bg, rgba(114,46,209,0.12))";
        const workedWeekendStyle = {
          border: "2px solid var(--dtr-worked-weekend-border, #fa541c)",
          backgroundColor: "var(--dtr-worked-weekend-bg, rgba(250,84,28,0.15))",
        };
        const holidayStyle = {
          border: "2px solid var(--dtr-holiday-border, #faad14)",
          backgroundColor: holidayBg,
        };
        const trainingStyle = {
          border: "2px solid var(--dtr-training-border, #722ed1)",
          backgroundColor: trainingBg,
        };

        const tileStyle = {
          width: 45,
          minHeight: 48,
          background: isTrainingDay
            ? trainingBg
            : holiday
            ? holidayBg
            : isWeekend
            ? weekendBg
            : hasLogs
            ? "var(--dtr-haslogs-bg, rgba(82,196,26,0.18))"
            : "var(--dtr-empty-bg, rgba(255,255,255,0.06))",
          border: "1px solid var(--app-border-color, rgba(0,0,0,0.12))",
          borderRadius: 4,
          padding: 4,
          fontSize: 10,
          color: "var(--app-text-color, #141414)",
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

        // Helper: normalize and sort time strings, returning dayjs objects and formatted strings
        const normalizeTimes = (arr) => {
          const list = (Array.isArray(arr) ? arr : [arr]).filter(Boolean);
          const parsed = list
            .map((t) => ({ raw: t, d: dayjs(t, "hh:mm A") }))
            .filter((o) => o.d && o.d.isValid())
            .sort((a, b) => (a.d.isBefore(b.d) ? -1 : 1));
          // dedupe by formatted time (hh:mm A)
          const seen = new Set();
          const unique = [];
          parsed.forEach((o) => {
            const k = o.d.format("hh:mm A");
            if (!seen.has(k)) {
              seen.add(k);
              unique.push({ raw: o.raw, formatted: k, d: o.d });
            }
          });
          return unique;
        };

        // Decide whether label should pick earliest or latest
        const pickEarliestLabels = new Set(["Time In", "Break Out", "OT In"]);
        const pickLatestLabels = new Set(["Time Out", "Break In", "OT Out"]);

        // Compute primary (earliest/latest) display values for main tile
        const getPrimaryForLabel = (label, times) => {
          const items = normalizeTimes(times);
          if (!items || items.length === 0) return null;
          if (pickEarliestLabels.has(label)) return items[0].formatted;
          if (pickLatestLabels.has(label)) return items[items.length - 1].formatted;
          // default: show all unique times joined
          return items.map((i) => i.formatted).join(", ");
        };

        const primaryTimeIn = getPrimaryForLabel("Time In", dayLogs?.["Time In"]);
        const primaryTimeOut = getPrimaryForLabel("Time Out", dayLogs?.["Time Out"]);
        const primaryOTIn = getPrimaryForLabel("OT In", dayLogs?.["OT In"]);
        const primaryOTOut = getPrimaryForLabel("OT Out", dayLogs?.["OT Out"]);
        const hasOT = !!(primaryOTIn || primaryOTOut);

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
            {holiday && (
              <div style={{ marginTop: 6, color: "var(--app-text-color)" }}>
                {holiday.type === "Suspension" ? (
                  <>
                    {holiday.scope && (
                      <div>
                        <strong>Scope:</strong> {holiday.scope}
                      </div>
                    )}
                    {holiday.location && (
                      <div>
                        <strong>Location:</strong> {holiday.location}
                      </div>
                    )}
                    {(holiday.referenceType || holiday.referenceNo) && (
                      <div>
                        <strong>Reference:</strong>{" "}
                        {holiday.referenceType || ""}{" "}
                        {holiday.referenceNo ? (
                          holiday.referenceNo.startsWith("http") ? (
                            <a
                              href={holiday.referenceNo}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {holiday.referenceNo}
                            </a>
                          ) : (
                            holiday.referenceNo
                          )
                        ) : (
                          ""
                        )}
                      </div>
                    )}
                    {holiday.endDate && (
                      <div>
                        <strong>Effective:</strong>{" "}
                        {dayjs(holiday.date).format("YYYY-MM-DD")} →{" "}
                        {dayjs(holiday.endDate).format("YYYY-MM-DD")}
                      </div>
                    )}
                    {holiday.notes && (
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        <strong>Notes:</strong> {holiday.notes}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {holiday.location && (
                      <div>
                        <strong>Location:</strong> {holiday.location}
                      </div>
                    )}
                    {holiday.endDate && (
                      <div>
                        <strong>Effective:</strong>{" "}
                        {dayjs(holiday.date).format("YYYY-MM-DD")} →{" "}
                        {dayjs(holiday.endDate).format("YYYY-MM-DD")}
                      </div>
                    )}
                    {holiday.notes && (
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        <strong>Notes:</strong> {holiday.notes}
                      </div>
                    )}
                  </>
                )}
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
                    const items = normalizeTimes(times);
                    if (!items || items.length === 0) return null;

                    const display = pickEarliestLabels.has(label)
                      ? items[0].formatted
                      : pickLatestLabels.has(label)
                      ? items[items.length - 1].formatted
                      : items.map((i) => i.formatted).join(", ");

                    return (
                      <div key={label}>
                        <strong>{label}:</strong>{" "}
                        {display}
                      </div>
                    );
                  })
              : !isTrainingDay && (
                  <div
                    style={{
                      color: "var(--app-text-muted, #9ca3af)",
                      fontSize: 11,
                    }}
                  >
                    No Data
                  </div>
                )}
          </div>
        );

        return (
          <Popover
            key={dayNum}
            content={popoverContent}
            trigger="click"
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
                    fontSize: isWeekend ? 8 : 10,
                    color: "var(--app-text-muted, #595959)",
                  }}
                >
                  {dateObj.format("ddd")}
                </div>
                {holiday && (
                  <span style={{ fontSize: 8, color: "#faad14" }}>
                    {holiday.type === "Suspension" ? "No work" : "Holiday"}
                  </span>
                )}
                {trainingLoading && (
                  <span style={{ display: "block", marginTop: 2 }}>
                    <Spin indicator={loadingIndicator} size="small" />
                  </span>
                )}
                {!trainingLoading && isTrainingDay && (
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
              {hasOT && (
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <Tag
                    color="#fa8c16"
                    style={{ fontSize: 10, padding: "0 6px", borderRadius: 3 }}
                  >
                    OT
                  </Tag>
                </div>
              )}
            </div>
          </Popover>
        );
      })}
    </div>
  );
};

export default DTRDayTiles;
