export function setHomeTab(document, name) {
  for (const panel of ["model", "upload"]) {
    document.getElementById(`tab-panel-${panel}`).classList.toggle("active", panel === name);
  }

  for (const btn of document.querySelectorAll(".tab-btn")) {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  }
}

export function prepareFileInputForPick(input) {
  input.value = "";
}
