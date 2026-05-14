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
  showHour,
}) {
  let playerInterval = null;

  function isPlaying() {
    return playerInterval !== null;
  }

  function setPlaying(playing) {
    iconPlay.style.display = playing ? "none" : "";
    iconPause.style.display = playing ? "" : "none";
    syncPlayButtonAvailability();
  }

  function syncPlayButtonAvailability() {
    const modelState = getModelState();
    const isAnimationCacheReady = !modelState || isAnimationCacheReadyForPlayback();
    if (!isAnimationCacheReady && playerInterval !== null) stopPlayer();
    playButton.disabled = !isAnimationCacheReady;
    const label = isAnimationCacheReady
      ? playerInterval !== null
        ? "Pause"
        : "Play"
      : "Preparing animation cache";
    playButton.title = label;
    playButton.setAttribute("aria-label", label);
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
    if (!isAnimationCacheReadyForPlayback()) return;
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
