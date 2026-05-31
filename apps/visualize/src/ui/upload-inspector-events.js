export function bindUploadInspectorEvents({ dom, handlers }) {
  const controller = new AbortController();
  const { signal } = controller;
  const { dropZone, fileInput, cards } = dom.upload;

  dropZone.addEventListener("click", handlers.onFilePickRequest, { signal });

  dropZone.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlers.onFilePickRequest();
      }
    },
    { signal },
  );

  fileInput.addEventListener(
    "change",
    () => {
      const file = fileInput.files[0];
      if (file) handlers.onFileSelected(file);
    },
    { signal },
  );

  dropZone.addEventListener(
    "dragover",
    (event) => {
      event.preventDefault();
      dropZone.classList.add("over");
    },
    { signal },
  );

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"), {
    signal,
  });

  dropZone.addEventListener(
    "drop",
    (event) => {
      event.preventDefault();
      dropZone.classList.remove("over");
      const file = event.dataTransfer?.files[0];
      if (file) handlers.onFileSelected(file);
    },
    { signal },
  );

  cards.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(".btn-grid");
      if (button) handlers.onUploadedVariableOpen(button.dataset.var);
    },
    { signal },
  );

  return () => controller.abort();
}
