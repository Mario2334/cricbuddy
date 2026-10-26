import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Minimal renderHook on react-test-renderer: the repo's RTL is a stub, so hooks are tested here. */
export function renderHook<T>(callback: () => T): { result: { current: T }; rerender: () => Promise<void>; unmount: () => Promise<void> } {
  const result = { current: undefined as unknown as T };
  function Probe() {
    result.current = callback();
    return null;
  }
  let root: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    root = TestRenderer.create(React.createElement(Probe));
  });
  return {
    result,
    rerender: async () => {
      await act(async () => {
        root?.update(React.createElement(Probe));
      });
    },
    unmount: async () => {
      await act(async () => {
        root?.unmount();
      });
    },
  };
}

/** Run a state-changing hook call inside act (silences the "not wrapped in act" warning). */
export async function actOn(fn: () => unknown | Promise<unknown>): Promise<void> {
  await act(async () => {
    await fn();
  });
}

/** Flush pending promises and timers inside act. */
export async function flush(ms = 0): Promise<void> {
  await act(async () => {
    if (ms) jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

export { jsonResponse };
