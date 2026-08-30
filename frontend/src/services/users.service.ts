import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  status: string;
  lastLogin: string;
}

export const usersService = {
  async getAllUsers(params?: { page?: number; limit?: number; search?: string }): Promise<any> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.USERS.GET_ALL, { params });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateUser(id: string, role: string, status: string): Promise<void> {
    try {
      await axiosInstance.put(ENDPOINTS.USERS.UPDATE(id), { role, status });
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Force-logouts a user by POSTing to the dedicated endpoint.
   * The backend will: (1) revoke all refresh sessions, (2) set status=Locked in DB.
   * Because JwtStrategy checks status on every request, the user is immediately
   * denied access on their next API call — real-time enforcement without blacklisting JWTs.
   */
  async forceLogout(id: string): Promise<{ message: string; status: string }> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.USERS.FORCE_LOGOUT(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createUser(userData: any): Promise<any> {
    try {
      const response = await axiosInstance.post("/auth/register", userData);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
