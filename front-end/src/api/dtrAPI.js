import axiosInstance from "./axiosInstance";

// Fetch recent attendance (based on daily grouped logs, similar to getWorkCalendarLogs)
export const getRecentAttendance = async (startDate, endDate) => {
  try {
    const res = await axiosInstance.get("/dtr/recent-daily-attendance", {
      params: { startDate, endDate },
    });

    // Backend returns { success, data }, unwrap `data`
    if (res.data && res.data.success) {
      return res.data.data;
    }

    return [];
  } catch (error) {
    console.error("API Error - getRecentAttendance:", error);
    throw error;
  }
};
