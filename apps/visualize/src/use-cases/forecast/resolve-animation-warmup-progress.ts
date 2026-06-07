type AnimationCacheStatus = "waiting" | "building" | "ready" | string;

interface ForecastResourceState {
  key: string;
  status?: string;
}

interface ForecastWarmupModelState {
  animationCacheStatus?: AnimationCacheStatus;
  availableBlocks?: Set<string>;
  hourList: unknown[];
  resources: ForecastResourceState[];
}

interface ResolveAnimationWarmupProgressInput {
  modelState?: ForecastWarmupModelState | null;
  ready: number;
}

function hasPendingDownloads(modelState: ForecastWarmupModelState) {
  return modelState.resources.some(
    (block) => block.status === "downloading" || !modelState.availableBlocks?.has(block.key),
  );
}

function animationWarmupLabel(
  modelState: ForecastWarmupModelState,
  { isWaiting, isReady }: { isWaiting: boolean; isReady: boolean },
) {
  if (isWaiting && hasPendingDownloads(modelState)) {
    return "Animation cache: waiting for downloads";
  }

  if (isWaiting) {
    return "Preparing animation cache";
  }

  if (isReady) {
    return "Animation ready";
  }

  return "Animation cache";
}

export function resolveAnimationWarmupProgress({
  modelState,
  ready,
}: ResolveAnimationWarmupProgressInput) {
  if (!modelState?.hourList.length) {
    return {
      cacheStatus: modelState?.animationCacheStatus ?? "waiting",
      progress: {
        hidden: true,
        isReady: false,
        isWaiting: false,
        label: "Animation cache",
        percent: 0,
        ready: 0,
        total: 0,
      },
    };
  }

  const total = modelState.hourList.length;
  const complete = ready === total;
  const cacheStatus =
    modelState.animationCacheStatus === "building" && complete
      ? "ready"
      : modelState.animationCacheStatus;
  const isWaiting = cacheStatus === "waiting";
  const isReady = cacheStatus === "ready";

  return {
    cacheStatus,
    progress: {
      hidden: isReady,
      isReady,
      isWaiting,
      label: animationWarmupLabel(modelState, { isWaiting, isReady }),
      percent: Math.round((ready / total) * 100),
      ready,
      total,
    },
  };
}
