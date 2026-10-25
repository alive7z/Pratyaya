import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "../src/components/ErrorBoundary.jsx";
import { AuthGate } from "../src/components/AuthGate.jsx";
import { AuthProvider } from "../src/app/AuthContext.jsx";

afterEach(() => {
  cleanup();
});

function ProblemChild() {
  throw new Error("Crash test failure");
}

describe("ErrorBoundary component", () => {
  it("catches errors and renders fallback with go back button", () => {
    // Suppress React error boundary console log for this test
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("Something went wrong"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Crash test failure/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go back" }),
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });
});

describe("AuthGate component", () => {
  it("renders demo options and go back button", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <AuthGate
            title="Chaos Lab"
            description="Inject faults across providers"
          />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByText("Chaos Lab")).toBeInTheDocument();
    expect(
      screen.getByText("Inject faults across providers"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go back" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Explore as Admin/i }),
    ).toBeInTheDocument();
  });
});
