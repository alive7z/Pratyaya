import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "../src/pages/AuthPage.jsx";

function response(data) {
  return new Response(
    JSON.stringify({ data, meta: { requestId: "auth-test" } }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("credential-free demo access", () => {
  it("keeps all four Explore roles on login and register", () => {
    const { rerender } = render(
      <MemoryRouter>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    for (const label of ["Merchant", "Admin", "Developer", "Risk Analyst"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Explore as ${label}`) }),
      ).toBeInTheDocument();
    }

    rerender(
      <MemoryRouter>
        <AuthPage mode="register" />
      </MemoryRouter>,
    );

    for (const label of ["Merchant", "Admin", "Developer", "Risk Analyst"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Explore as ${label}`) }),
      ).toBeInTheDocument();
    }
  });

  it("starts a backend demo session for the selected role", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => response({ role: "ADMIN" }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Explore as Admin/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/demo/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ role: "ADMIN" }),
      }),
    );
  });
});
