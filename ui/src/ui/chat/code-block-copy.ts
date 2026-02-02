/**
 * Inject copy buttons into rendered code blocks (<pre> elements).
 *
 * Call `observeCodeBlocks(root)` on the chat container. Returns a cleanup
 * function that disconnects the MutationObserver.
 */

const COPIED_MS = 1500;
const MARKER = "cbCopyInjected";

const COPY_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function getCodeText(pre: HTMLPreElement): string {
  const code = pre.querySelector("code");
  return (code ?? pre).textContent ?? "";
}

function createCopyBtn(pre: HTMLPreElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cb-copy-btn";
  btn.title = "Copy code";
  btn.setAttribute("aria-label", "Copy code");
  btn.innerHTML = `<span class="cb-copy-btn__icon">${COPY_ICON}</span>`;

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (btn.dataset.copying === "1") return;

    btn.dataset.copying = "1";
    const text = getCodeText(pre);

    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      /* clipboard write failed */
    }

    delete btn.dataset.copying;

    if (ok) {
      btn.dataset.copied = "1";
      btn.innerHTML = `<span class="cb-copy-btn__icon">${CHECK_ICON}</span>`;
      btn.title = "Copied";
      setTimeout(() => {
        if (!btn.isConnected) return;
        delete btn.dataset.copied;
        btn.innerHTML = `<span class="cb-copy-btn__icon">${COPY_ICON}</span>`;
        btn.title = "Copy code";
      }, COPIED_MS);
    }
  });

  return btn;
}

function processPreElement(pre: HTMLPreElement): void {
  if (pre.dataset[MARKER]) return;
  pre.dataset[MARKER] = "1";

  const wrapper = document.createElement("div");
  wrapper.className = "cb-code-wrapper";
  pre.parentNode?.insertBefore(wrapper, pre);
  wrapper.appendChild(pre);
  wrapper.appendChild(createCopyBtn(pre));
}

function scanForPreElements(root: HTMLElement): void {
  const pres = root.querySelectorAll<HTMLPreElement>("pre");
  for (const pre of pres) {
    processPreElement(pre);
  }
}

/**
 * Set up a MutationObserver on `root` to automatically inject copy buttons
 * into any <pre> elements that appear. Also does an initial sweep.
 *
 * Returns a cleanup function that disconnects the observer.
 */
export function observeCodeBlocks(root: HTMLElement): () => void {
  scanForPreElements(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === "PRE") {
          processPreElement(node as HTMLPreElement);
        }
        const pres = node.querySelectorAll<HTMLPreElement>("pre");
        for (const pre of pres) {
          processPreElement(pre);
        }
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true });

  return () => observer.disconnect();
}
