import axiosInstance from "../../../api/axios";

const API = "/exit";

export const exitApi = {
  getExits: async () => {
    const res = await axiosInstance.get(API);
    return res.data;
  },
  getExitDetails: async (id: string) => {
    const res = await axiosInstance.get(`${API}/${id}`);
    return res.data;
  },
  submitResignation: async (data: any) => {
    const res = await axiosInstance.post(API, data);
    return res.data;
  },
  managerApprove: async (id: string, data: any) => {
    const res = await axiosInstance.patch(`${API}/${id}/manager-approve`, data);
    return res.data;
  },
  hrApprove: async (id: string, data: any) => {
    const res = await axiosInstance.patch(`${API}/${id}/hr-approve`, data);
    return res.data;
  },
  advanceToChecklist: async (id: string) => {
    const res = await axiosInstance.patch(`${API}/${id}/checklist`);
    return res.data;
  },
  generateSettlement: async (id: string) => {
    const res = await axiosInstance.post(`${API}/${id}/settlement`);
    return res.data;
  },
};
