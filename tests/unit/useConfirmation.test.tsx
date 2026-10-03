import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConfirmation } from "@/hooks/useConfirmation";

afterEach(() => vi.useRealTimers());

describe("useConfirmation", () => {
  it("n'exécute l'action qu'au second clic", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmation(action));
    act(() => result.current.declencher());
    expect(result.current.enAttente).toBe(true);
    expect(action).not.toHaveBeenCalled();
    act(() => result.current.declencher());
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.enAttente).toBe(false);
  });

  it("se désarme tout seul après 4 s", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmation(action));
    act(() => result.current.declencher());
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.enAttente).toBe(false);
    act(() => result.current.declencher()); // il faut de nouveau confirmer
    expect(action).not.toHaveBeenCalled();
  });

  it("ne laisse aucun minuteur après le démontage", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useConfirmation(vi.fn()));
    act(() => result.current.declencher());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
