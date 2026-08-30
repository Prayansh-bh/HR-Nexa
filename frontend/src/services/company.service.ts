import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";
import { SaaSCompany } from "../store/companyStore";

/**
 * Authoritatively extract immutable company joined/creation date in 'YYYY-MM-DD' format.
 * Precedence: Company.createdAt -> Subscription.createdAt -> Subscription.start (fallback)
 */
function extractCompanyJoinedDate(sub: any): string {
  const rawCreated = sub.companyRelation?.createdAt || sub.createdAt || sub.start;
  if (!rawCreated) return "";
  if (typeof rawCreated === "string") {
    return rawCreated.slice(0, 10);
  }
  if (rawCreated instanceof Date || typeof rawCreated?.toISOString === "function") {
    return new Date(rawCreated).toISOString().slice(0, 10);
  }
  return String(rawCreated).slice(0, 10);
}

export const companyService = {
  async getCompanies(): Promise<SaaSCompany[]> {
    try {
      const response = await axiosInstance.get("/subscriptions");
      const data = response.data;
      const subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
      return subscriptions.map((sub: any) => ({
        id: sub.id,
        name: sub.company,
        plan: sub.plan,
        employeesCount: sub.employeesCount ?? 0,
        status:
          String(sub.status || "").toLowerCase() === "paid" ||
          String(sub.status || "").toLowerCase() === "active"
            ? "Active"
            : sub.status || "Active",
        joinedDate: extractCompanyJoinedDate(sub),
        billingStartDate: sub.start || "",
        expiryDate: sub.expiry,
        createdAt: sub.companyRelation?.createdAt
          ? new Date(sub.companyRelation.createdAt).toISOString()
          : sub.createdAt
            ? new Date(sub.createdAt).toISOString()
            : undefined,
        ownerName: sub.ownerName || "",
        ownerEmail: sub.ownerEmail || "",
        purchasedSeats: sub.purchasedSeats ?? 50,
        usedSeats: sub.usedSeats ?? sub.employeesCount ?? 0,
        logo: sub.logo || sub.company?.slice(0, 2).toUpperCase() || "CO",
        gst: sub.gst || "",
        pan: sub.pan || "",
        cin: sub.cin || "",
        address: sub.address || "",
        contact: sub.contact || sub.ownerName || "",
        hrAdmin: sub.hrAdmin || "",
        storageUsed: sub.storageUsed || "0 GB / 10 GB",
        billing: sub.billing || "Active Subscription",
        apiKeys: sub.apiKeys || 0,
        loginActivity: sub.loginActivity || "",
      }));
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createCompany(companyData: Partial<SaaSCompany>): Promise<SaaSCompany> {
    try {
      const response = await axiosInstance.post("/subscriptions", {
        company: companyData.name,
        plan: companyData.plan || "BASIC",
        status: companyData.status || "Active",
        cycle: companyData.status === "Trial" ? "Trial" : "Monthly",
        contact: companyData.contact,
        ownerName: companyData.ownerName,
        ownerEmail: companyData.ownerEmail,
        gst: companyData.gst,
        pan: companyData.pan,
        cin: companyData.cin,
        address: companyData.address,
        hrAdmin: companyData.hrAdmin,
        employeesCount: companyData.employeesCount,
        purchasedSeats: companyData.purchasedSeats,
        usedSeats: companyData.usedSeats,
      });
      const sub = response.data;
      return {
        id: sub.id,
        name: sub.company,
        plan: sub.plan,
        employeesCount: sub.employeesCount ?? 1,
        status: sub.status === "Paid" || sub.status === "Active" ? "Active" : sub.status,
        joinedDate: extractCompanyJoinedDate(sub),
        billingStartDate: sub.start || "",
        expiryDate: sub.expiry,
        createdAt: sub.companyRelation?.createdAt
          ? new Date(sub.companyRelation.createdAt).toISOString()
          : sub.createdAt
            ? new Date(sub.createdAt).toISOString()
            : undefined,
        ownerName: sub.ownerName || companyData.ownerName || "",
        ownerEmail: sub.ownerEmail || companyData.ownerEmail || "",
        purchasedSeats: sub.purchasedSeats ?? 20,
        usedSeats: sub.usedSeats ?? 1,
        logo: sub.logo || sub.company?.slice(0, 2).toUpperCase() || "CO",
        gst: sub.gst || "",
        pan: sub.pan || "",
        cin: sub.cin || "",
        address: sub.address || "",
        contact: sub.contact || companyData.contact || "",
        hrAdmin: sub.hrAdmin || "",
        storageUsed: sub.storageUsed || "0 GB / 10 GB",
        billing: sub.billing || "Active Subscription",
        apiKeys: 0,
        loginActivity: "",
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateCompanyStatus(id: string, status: string): Promise<any> {
    try {
      if (status === "Active") {
        const response = await axiosInstance.put(`/subscriptions/${id}/reactivate`);
        return response.data;
      }
      if (status === "Suspended") {
        const response = await axiosInstance.put(`/subscriptions/${id}/suspend`, {
          reason: "Suspended by SuperAdmin",
        });
        return response.data;
      }
      throw new Error(
        `Unsupported status transition: "${status}". Only "Active" and "Suspended" are supported.`,
      );
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteCompany(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/subscriptions/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async purgeCompany(id: string, confirmCompanyName?: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/subscriptions/${id}/purge`, {
        data: { confirmCompanyName },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async extendTrial(id: string): Promise<any> {
    try {
      const response = await axiosInstance.put(`/subscriptions/${id}/extend-trial`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async addStorage(id: string, storageGB: number): Promise<any> {
    try {
      const response = await axiosInstance.post(`/subscriptions/${id}/add-storage`, { storageGB });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async resetPassword(id: string): Promise<any> {
    try {
      const response = await axiosInstance.post(`/subscriptions/${id}/reset-password`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async editProfile(id: string, data: Partial<SaaSCompany>): Promise<any> {
    try {
      const response = await axiosInstance.put(`/subscriptions/${id}/profile`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async changePlan(id: string, plan: string): Promise<any> {
    try {
      const response = await axiosInstance.put(`/subscriptions/${id}/upgrade`, { plan });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async approveCompany(id: string): Promise<any> {
    try {
      const response = await axiosInstance.put(`/subscriptions/${id}/approve`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async rejectCompany(id: string, reason?: string): Promise<any> {
    try {
      const response = await axiosInstance.put(`/subscriptions/${id}/reject`, { reason });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
