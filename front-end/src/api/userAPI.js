import axiosInstance from "./axiosInstance";

export const getUsers = async () => {
  try {
    const response = await axiosInstance.get("/users");
    //console.log("Fetched users (API):", response.data);

    // Normalize: ensure we always return an array
    const usersArray = Array.isArray(response.data)
      ? response.data
      : response.data?.data || [];

    return usersArray;
  } catch (error) {
    console.error("Failed to fetch users", error);
    throw error;
  }
};
