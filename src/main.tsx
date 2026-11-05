import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { AuthProvider } from "./auth/AuthProvider";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Не найден элемент #root");

createRoot(container).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="top-right" />
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
