export function createForecastWarmupView({ bar, count, label, root }) {
  function render(state) {
    root.hidden = state.hidden;
    root.classList.toggle("waiting", state.isWaiting);
    root.classList.toggle("ready", state.isReady);
    bar.style.width = `${state.percent}%`;
    count.textContent = `${state.ready} / ${state.total}`;
    label.textContent = state.label;
  }

  return { render };
}
