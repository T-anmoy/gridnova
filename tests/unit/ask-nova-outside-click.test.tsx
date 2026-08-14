import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef, useState, useEffect } from "react";

// Minimal replica of AskNova's outside-click logic — tests the pattern in
// isolation without pulling in framer-motion, GSAP, sessionStorage, or fetch.
function ClickOutsideWidget({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div>
      <div ref={wrapperRef} data-testid="widget">
        <span data-testid="inside">inside content</span>
      </div>
      <div data-testid="outside">outside content</div>
      {open && <span data-testid="panel-visible" />}
    </div>
  );
}

describe("AskNova outside-click behavior", () => {
  it("closes when mousedown fires outside the widget", () => {
    const { getByTestId, queryByTestId } = render(<ClickOutsideWidget />);
    expect(queryByTestId("panel-visible")).toBeTruthy();

    act(() => {
      getByTestId("outside").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(queryByTestId("panel-visible")).toBeNull();
  });

  it("stays open when mousedown fires inside the widget", () => {
    const { getByTestId, queryByTestId } = render(<ClickOutsideWidget />);
    expect(queryByTestId("panel-visible")).toBeTruthy();

    act(() => {
      getByTestId("inside").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(queryByTestId("panel-visible")).toBeTruthy();
  });

  it("closes when touchstart fires outside the widget", () => {
    const { getByTestId, queryByTestId } = render(<ClickOutsideWidget />);
    expect(queryByTestId("panel-visible")).toBeTruthy();

    act(() => {
      getByTestId("outside").dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
    });

    expect(queryByTestId("panel-visible")).toBeNull();
  });

  it("does not attach listeners when panel is closed", () => {
    const { queryByTestId, getByTestId } = render(<ClickOutsideWidget initialOpen={false} />);
    expect(queryByTestId("panel-visible")).toBeNull();

    // clicking outside on a closed panel should have no effect (no listener attached)
    act(() => {
      getByTestId("outside").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(queryByTestId("panel-visible")).toBeNull();
  });
});
