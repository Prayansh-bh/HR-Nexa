export * from "../../../types/auth";

export type LoginPayload = {
  email: string;
  pass: string;
};

export type AuthResponse = {
  access_token: string;
  user: import("../../../types/auth").AuthUser;
};
