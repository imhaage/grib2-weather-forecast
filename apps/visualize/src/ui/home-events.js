export function bindHomeEvents({ dom, handlers }) {
  const controller = new AbortController();
  const { signal } = controller;

  for (const button of dom.home.tabButtons) {
    button.addEventListener(
      "click",
      () => {
        handlers.onHomeTabSelect(button.dataset.tab);
      },
      { signal },
    );
  }

  dom.home.modelList.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest('[data-action="show-package"]');
      if (button) handlers.onPackageSelect(button.dataset.packageKey);
    },
    { signal },
  );

  return () => controller.abort();
}
