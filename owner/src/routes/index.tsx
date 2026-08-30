import { createFileRoute, redirect } from "@tanstack/react-router";
import { OWNER_STORAGE_KEYS } from "../config/storage";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const userString =
      typeof window !== "undefined"
        ? localStorage.getItem(OWNER_STORAGE_KEYS.USER)
        : null;

    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (user.role === "SuperAdmin") {
          throw redirect({ to: "/dashboard" });
        }
      } catch (e) {
        if (e && (e as any).to) throw e;
      }
    }
    throw redirect({ to: "/login" });
  },
});
