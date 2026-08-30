import { AxiosError } from "axios";

export class ApiError extends Error {
  status?: number;
  code?: string;
  purchasedSeats?: number;
  usedSeats?: number;

  constructor(
    message: string,
    status?: number,
    code?: string,
    purchasedSeats?: number,
    usedSeats?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.purchasedSeats = purchasedSeats;
    this.usedSeats = usedSeats;
  }
}

export function handleApiError(error: any): never {
  if (error && error.isAxiosError) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    let message = "An unexpected error occurred. Please try again.";
    let code: string | undefined = undefined;
    let purchasedSeats: number | undefined = undefined;
    let usedSeats: number | undefined = undefined;

    if (data && typeof data === "object") {
      const rawMessage = data.message || data.error;
      if (Array.isArray(rawMessage)) {
        message = rawMessage.join(", ");
      } else if (typeof rawMessage === "string") {
        message = rawMessage;
      }
      code = data.errorCode || data.code;
      purchasedSeats = data.purchasedSeats;
      usedSeats = data.usedSeats;
    } else if (axiosError.message) {
      message = axiosError.message;
    }

    throw new ApiError(message, status, code, purchasedSeats, usedSeats);
  }

  if (error instanceof Error) {
    throw new ApiError(error.message);
  }

  throw new ApiError(String(error || "Unknown error occurred."));
}
