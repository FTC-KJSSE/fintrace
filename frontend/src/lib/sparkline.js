const NS = "http://www.w3.org/2000/svg";

/**
 * Renders a small inline SVG polyline sparkline for a series of RTT samples.
 * No charting library — keeps the stack to plain DOM/SVG.
 */
export function renderSparkline(values, { width = 56, height = 18, color = "#8e959d" } = {}) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.classList.add("hop-sparkline");

  if (values.length < 2) return svg;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const polyline = document.createElementNS(NS, "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", color);
  polyline.setAttribute("stroke-width", "1.5");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  svg.appendChild(polyline);

  return svg;
}
