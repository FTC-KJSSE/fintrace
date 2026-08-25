export const COMPARE_COLORS = ["#38bdf8", "#a78bfa", "#f472b6"];

export function buildCompareSlots(container, endpoints) {
  container.innerHTML = "";
  const selects = [];

  for (let i = 0; i < 3; i++) {
    const select = document.createElement("select");
    select.className = "compare-slot";
    select.dataset.slot = String(i);
    select.style.borderColor = COMPARE_COLORS[i];

    for (const ep of endpoints) {
      const option = document.createElement("option");
      option.value = ep.id;
      option.textContent = ep.label;
      select.appendChild(option);
    }
    select.selectedIndex = Math.min(i, endpoints.length - 1);

    container.appendChild(select);
    selects.push(select);
  }

  return selects;
}
