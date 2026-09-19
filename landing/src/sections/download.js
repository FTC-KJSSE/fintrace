import { BUILDS, PLATFORM, RELEASES_URL, REPO, VERSION } from "../data/release.js";
import { copyText } from "../lib/copy.js";
import { el } from "../lib/dom.js";
import { icons } from "../lib/icons.js";

function checksumButton(build) {
  // No verified checksum means no checksum affordance. An unverifiable hash is
  // worse than none, so the row simply doesn't render.
  if (!build.sha256) return null;

  const short = `${build.sha256.slice(0, 20)}…${build.sha256.slice(-8)}`;
  const state = el("span", { class: "state" }, [el("span", { html: icons.copy(13) }), el("span", { text: "Copy" })]);
  const button = el(
    "button",
    { class: "checksum", type: "button", "aria-label": `Copy SHA-256 checksum for ${build.filename}` },
    [el("span", { class: "label", text: "sha256" }), el("span", { class: "value", text: short }), state]
  );

  let timer = 0;
  button.addEventListener("click", async () => {
    const ok = await copyText(build.sha256);
    clearTimeout(timer);
    button.classList.toggle("is-copied", ok);
    state.replaceChildren(
      el("span", { html: ok ? icons.check(13) : icons.alert(13) }),
      el("span", { text: ok ? "Copied" : "Press ⌘C" })
    );
    timer = setTimeout(() => {
      button.classList.remove("is-copied");
      state.replaceChildren(el("span", { html: icons.copy(13) }), el("span", { text: "Copy" }));
    }, 2000);
  });

  return button;
}

function buildCard(build) {
  return el("article", { class: `card dl-card${build.recommended ? " dl-card--rec" : ""}`, "data-reveal": true }, [
    el("div", { class: "dl-top" }, [
      el("span", { class: "dl-glyph", html: icons.windows(22) }),
      el("div", { class: "dl-heading" }, [
        el("h3", {}, [
          build.name,
          build.recommended ? el("span", { class: "pill pill--amber", text: "Recommended" }) : null,
        ]),
        el("p", { text: build.blurb }),
      ]),
    ]),
    el("div", { class: "dl-file" }, [
      el("span", { class: "dl-filename", text: build.filename }),
      el("span", { class: "dl-size", text: build.size }),
    ]),
    el(
      "ul",
      { class: "dl-details" },
      build.details.map((d) => el("li", {}, [el("span", { html: icons.check(13) }), el("span", { text: d })]))
    ),
    checksumButton(build),
    el(
      "a",
      {
        class: `btn ${build.recommended ? "btn--primary" : "btn--ghost"} btn--block`,
        href: build.url,
        rel: "noopener",
      },
      [el("span", { html: icons.arrowDown(16) }), `Download ${build.name.toLowerCase()}`]
    ),
  ]);
}

export function renderDownload({ grid, meta, notice, footerMeta }) {
  if (grid) grid.replaceChildren(...BUILDS.map(buildCard));

  if (meta) {
    meta.replaceChildren(
      ...[
        ["Operating system", PLATFORM.os],
        ["Architecture", PLATFORM.arch],
        ["Runtime", PLATFORM.runtime],
        ["Privileges", PLATFORM.privileges],
      ].map(([k, v]) => el("div", {}, [el("dt", { text: k }), el("dd", { text: v })]))
    );
  }

  if (notice) {
    notice.replaceChildren(
      el("span", { html: icons.alert(18) }),
      el("div", {}, [
        el("h3", { text: "Windows will warn you about this download" }),
        el("p", {
          html:
            "These binaries are not code-signed, so SmartScreen shows <code>Windows protected your PC — Unknown Publisher</code>. " +
            "Choose <code>More info → Run anyway</code> to proceed. A code-signing certificate costs money this project doesn't have yet; " +
            `until then, verify the download against the source at <a href="${REPO}" target="_blank" rel="noopener">github.com/FTC-KJSSE/fintrace</a> ` +
            "and build it yourself if you'd rather not trust an unsigned binary.",
        }),
      ])
    );
  }

  if (footerMeta) {
    footerMeta.replaceChildren(
      ...[
        `v${VERSION}`,
        "Windows x64",
        "Electron 44",
        "Three.js r169",
        `38/38 tests passing`,
      ].map((t) => el("li", { text: t })),
      el("li", {}, [el("a", { href: RELEASES_URL, target: "_blank", rel: "noopener", text: "All releases" })])
    );
  }
}
