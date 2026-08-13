import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import '@testing-library/jest-dom';
vi.mock("@/app/providers", async () => ({
  AppProviders: ({ children }: { children?: ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
}));

vi.mock("react-router-dom", async () => ({
  RouterProvider: ({ router }: { router: unknown }) => (
    <div data-testid="router-provider">router:{String(router)}</div>
  ),
}));

vi.mock("@/app/router", () => ({
  router: "mock-router",
}));

import { App } from "./App";

describe("App", () => {
  it("renders AppProviders and RouterProvider", () => {
    render(<App />);

    expect(screen.getByTestId("app-providers")).toBeInTheDocument();
    expect(screen.getByTestId("router-provider")).toHaveTextContent("router:mock-router");
  });
});
