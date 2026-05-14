export function createAnimationPlayer({
  playButton,
  resetButton,
  slider,
  iconPlay,
  iconPause,
  getModelState,
  isBitmapCacheComplete,
  isAnimationCacheReadyForPlayback,
  queueCurrentTooltipValueHydration,
  queuePrerenderForAllBlocks,
  waitForPrerenderIdle,
  showHour,
  updateWarmupProgress,
}) {
  let playerInterval = null;
  let isPreparingAnimation = false;

  function isPlaying() {
    return playerInterval !== null;
  }

  function setPlaying(playing) {
    iconPlay.style.display = playing ? "none" : "";
    iconPause.style.display = playing ? "" : "none";
    syncPlayButtonAvailability();
  }

  function setPreparingAnimation(preparing) {
    isPreparingAnimation = preparing;
    updateWarmupProgress({ preparing });
  }

  function syncPlayButtonAvailability() {
    const modelState = getModelState();
    const isAnimationCacheReady = !modelState || isAnimationCacheReadyForPlayback();
    if (!isAnimationCacheReady && playerInterval !== null) stopPlayer();
    playButton.disabled = false;
    const label = playerInterval !== null
      ? "Pause"
      : "Play";
    playButton.title = label;
    playButton.setAttribute("aria-label", label);
  }

  async function warmUpBitmapCacheForAnimation() {
    if (!getModelState() || isAnimationCacheReadyForPlayback()) return true;
    setPreparingAnimation(true);
    try {
      queuePrerenderForAllBlocks();
      await waitForPrerenderIdle();
      updateWarmupProgress({ preparing: false });
      return isAnimationCacheReadyForPlayback();
    } finally {
      setPreparingAnimation(false);
    }
  }

  function startPlayer() {
    setPlaying(true);
    playerInterval = setInterval(() => {
      if (!getModelState()) {
        stopPlayer();
        return;
      }
      const max = parseInt(slider.max, 10);
      const next = (parseInt(slider.value, 10) + 1) % (max + 1);
      slider.value = next;
      showHour(next);
    }, 120);
  }

  function stopPlayer() {
    if (playerInterval === null) return;
    clearInterval(playerInterval);
    playerInterval = null;
    setPlaying(false);
    queueCurrentTooltipValueHydration();
  }

  playButton.addEventListener("click", async () => {
    if (!getModelState()) return;
    if (playerInterval !== null) {
      stopPlayer();
      return;
    }
    if (isPreparingAnimation) return;
    const ready = await warmUpBitmapCacheForAnimation();
    if (!ready || !getModelState() || playerInterval !== null) return;
    startPlayer();
  });

  resetButton.addEventListener("click", () => {
    if (!getModelState()) return;
    stopPlayer();
    slider.value = 0;
    showHour(0);
  });

  syncPlayButtonAvailability();

  return {
    isPlaying,
    stopPlayer,
    syncPlayButtonAvailability,
  };
}
