import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "../src/pages/SettingsPage.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";
import { ToastProvider } from "../src/components/ui/Toast.jsx";
import { authApi } from "../src/lib/apiClient.js";

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders in guest mode with appearance and demo role buttons without crashing", async () => {
    vi.spyOn(authApi, "me").mockRejectedValue(new Error("No session"));

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <SettingsPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Settings & Preferences" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Guest Exploration Mode")).toBeInTheDocument();
    expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Merchant" }),
    ).toBeInTheDocument();
  });

  it("allows switching demo roles without navigation buttons disappearing", async () => {
    vi.spyOn(authApi, "me").mockRejectedValue(new Error("No session"));
    vi.spyOn(authApi, "demo").mockResolvedValue({
      data: {
        user: { displayName: "Admin User", email: "admin@example.com" },
        membership: { role: "ADMIN", status: "ACTIVE" },
        merchant: { name: "Test Merchant" },
        permissions: ["payments.read"],
      },
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <SettingsPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Settings & Preferences" }),
    ).toBeInTheDocument();

    const adminButton = screen.getByRole("button", { name: "Admin" });
    await user.click(adminButton);

    expect(authApi.demo).toHaveBeenCalledWith("ADMIN");
  });
});
