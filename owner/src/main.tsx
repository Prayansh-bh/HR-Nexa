import "./i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { getOwnerRouter } from "./router";
import "./styles.css";

const router = getOwnerRouter();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>
  </StrictMode>,
);
