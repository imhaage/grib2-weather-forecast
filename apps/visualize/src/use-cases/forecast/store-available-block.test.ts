import { describe, expect, test, vi } from "vitest";
import {
  makeForecastDownloadSession,
  makeForecastRunState,
  makeRemoteResource,
} from "./forecast-test-fixtures";
import { createForecastAvailableBlockUseCase } from "./store-available-block";

describe("forecast available block use case", () => {
  test("stores a new block, marks it available, and increments the session count", async () => {
    const state = makeForecastRunState();
    const session = makeForecastDownloadSession();
    const block = makeRemoteResource();
    const useCase = createForecastAvailableBlockUseCase({
      incrementAvailableCount: vi.fn((session) => {
        session.availableCount++;
      }),
      invalidateBlockRenderCache: vi.fn(),
      markBlockAvailable: vi.fn((state, block) => state.availableBlocks.add(block.key)),
      setBlockStatus: vi.fn(),
      storeBlock: vi.fn(async () => true),
    });

    const stored = await useCase.storeAvailableBlock({
      block,
      buffer: new Uint8Array([1]),
      session,
      state,
      status: "ready",
    });

    expect(stored).toBe(true);
    expect(state.availableBlocks.has("01H")).toBe(true);
    expect(session.availableCount).toBe(1);
  });

  test("invalidates render cache without incrementing count when block was already available", async () => {
    const invalidateBlockRenderCache = vi.fn();
    const incrementAvailableCount = vi.fn();
    const state = makeForecastRunState({ availableBlocks: new Set(["01H"]) });
    const session = makeForecastDownloadSession({ availableCount: 1 });
    const block = makeRemoteResource();
    const useCase = createForecastAvailableBlockUseCase({
      incrementAvailableCount,
      invalidateBlockRenderCache,
      markBlockAvailable: vi.fn(),
      setBlockStatus: vi.fn(),
      storeBlock: vi.fn(async () => true),
    });

    await useCase.storeAvailableBlock({
      block,
      buffer: new Uint8Array([1]),
      session,
      state,
      status: "ready",
    });

    expect(invalidateBlockRenderCache).toHaveBeenCalledWith(block);
    expect(incrementAvailableCount).not.toHaveBeenCalled();
  });

  test("does not mutate state when worker storage fails", async () => {
    const state = makeForecastRunState();
    const session = makeForecastDownloadSession();
    const useCase = createForecastAvailableBlockUseCase({
      incrementAvailableCount: vi.fn(),
      invalidateBlockRenderCache: vi.fn(),
      markBlockAvailable: vi.fn(),
      setBlockStatus: vi.fn(),
      storeBlock: vi.fn(async () => false),
    });

    const stored = await useCase.storeAvailableBlock({
      block: makeRemoteResource(),
      buffer: new Uint8Array([1]),
      session,
      state,
      status: "ready",
    });

    expect(stored).toBe(false);
    expect(state.availableBlocks.size).toBe(0);
  });
});
