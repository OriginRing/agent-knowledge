import axios from "axios";
import { clearChatStore } from "@view/stores/chat";

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

interface HttpClient {
  get<T = any>(url: string, config?: any): Promise<ApiResponse<T>>;
  post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>>;
  put<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>>;
  delete<T = any>(url: string, config?: any): Promise<ApiResponse<T>>;
  patch<T = any>(
    url: string,
    data?: any,
    config?: any,
  ): Promise<ApiResponse<T>>;
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 60_000,
  withCredentials: true,
});

instance.interceptors.response.use(
  (response: any) => {
    if (response.status === 401 || response.status === 302) {
      clearChatStore();
      return Promise.reject(new Error("未登录"));
    }
    return response.data;
  },
  (error: any) => {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 302) {
        clearChatStore();
        return Promise.reject(new Error("未登录"));
      }
    }
    return Promise.reject(error);
  },
);

const httpClient = instance as unknown as HttpClient;

export default httpClient;
