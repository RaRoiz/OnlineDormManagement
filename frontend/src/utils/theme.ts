/**
 * Light / dark theme controller.
 * - Remembers the user's choice in localStorage.
 * - Falls back to the OS preference on first visit.
 * - Adds a floating toggle button to every page.
 *
 * A tiny inline script in each page's <head> applies the stored
 * theme before first paint to avoid a flash; this module keeps it
 * in sync and wires the toggle.
 */

type Theme = "light" | "dark";

const STORAGE_KEY = "dorm_theme";

function readPreferred(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(
    "data-theme",
    theme
  );
}

function setupTheme(): void {
  let theme = readPreferred();
  applyTheme(theme);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";

  const render = (): void => {
    const goingDark = theme === "light";

    button.textContent = goingDark ? "🌙" : "☀️";
    button.title = goingDark
      ? "โหมดมืด"
      : "โหมดสว่าง";
    button.setAttribute(
      "aria-label",
      goingDark
        ? "สลับเป็นโหมดมืด"
        : "สลับเป็นโหมดสว่าง"
    );
  };

  render();

  button.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    render();
  });

  document.body.append(button);

  // Follow OS changes only while the user hasn't chosen explicitly
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", event => {
      if (localStorage.getItem(STORAGE_KEY)) {
        return;
      }

      theme = event.matches ? "dark" : "light";
      applyTheme(theme);
      render();
    });
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    setupTheme
  );
} else {
  setupTheme();
}
