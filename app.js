const CONFIG = {
  title: "Nunhead Repair Café",
  logoUrl: "",
  endpoints: [
    "https://script.google.com/macros/s/AKfycbx8V-lwZMv0QUt5cRmxiKW17i1lCQtr9HKWYgXZzrSI7xTp4XZDsHX7UpRXxArUCh0s/exec",
    "https://script.googleusercontent.com/a/macros/sitechindustries.com/echo?user_content_key=AehSKLhBmY7eFa0sncM8k2Lhab4-KfNkfsGvmnf-MrhYQgV4CDh0g-7_svTEKvzxhIWr2ZT76Uy0JvaB5qA6rp9NYt7hd7G7zT6X_b0rnJfiPzaDvclLikFpfQB1TU9spTjmcsdKaH6DWKBoG6TkZqbZBk8F8xuA6hCAgTxRtaP2pCyJ7kVKin3vvGj7VMLxxq4zFUjiEkOa-K8cJbTQ8ENzqMR8BypH8pBKVOmG2U6QzKVv19kqSP3EiygZ_3KH_vZRIu8k5wYleHya-YmMV7LJMhnDGRDypQf-U5iPtGNhMyTm6ehRt77Tja3ScP4MWw&lib=MYMr4yAGcl7U7jXkvQkA424v0J4XZf0PJ",
  ],
  pollIntervalMs: 10000,
  requestTimeoutMs: 20000,
};

const elements = {
  title: document.querySelector("[data-role='title']"),
  logo: document.querySelector(".logo"),
  logoIcon: document.querySelector("[data-role='logo-icon']"),
  repairedCount: document.querySelector("[data-role='repaired-count']"),
  queueList: document.querySelector("[data-role='queue-list']"),
  queueCount: document.querySelector("[data-role='queue-count']"),
  repairingList: document.querySelector("[data-role='repairing-list']"),
  repairingCount: document.querySelector("[data-role='repairing-count']"),
  status: document.querySelector("[data-role='status']"),
  statusText: document.querySelector("[data-role='status-text']"),
  statusSpinner: document.querySelector("[data-role='status-spinner']"),
  timestamp: document.querySelector("[data-role='timestamp-text']"),
  themeToggle: document.querySelector("[data-role='theme-toggle']"),
};

const state = {
  lastPayload: null,
  lastUpdated: null,
  isFetching: false,
  needColours: new Map(),
  needHueSeed: Math.floor(Math.random() * 360),
  needIndex: 0,
};

const normaliseStatus = (status) => (status || "").trim().toLowerCase();

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const hslToRgb = (hue, saturation, lightness) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation / 100, 0, 1);
  const l = clamp(lightness / 100, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

const relativeLuminance = ({ r, g, b }) => {
  const toLinear = (value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
};

const contrastRatio = (rgbA, rgbB) => {
  const lumA = relativeLuminance(rgbA) + 0.05;
  const lumB = relativeLuminance(rgbB) + 0.05;
  return lumA > lumB ? lumA / lumB : lumB / lumA;
};

const ensureContrastLightness = (hue, saturation, lightness, againstRgb, min) => {
  let bestLightness = lightness;
  let bestRatio = contrastRatio(hslToRgb(hue, saturation, lightness), againstRgb);

  for (let step = 4; step <= 32; step += 4) {
    const darker = clamp(lightness - step, 8, 92);
    const lighter = clamp(lightness + step, 8, 92);
    const darkerRatio = contrastRatio(
      hslToRgb(hue, saturation, darker),
      againstRgb
    );
    const lighterRatio = contrastRatio(
      hslToRgb(hue, saturation, lighter),
      againstRgb
    );
    if (darkerRatio > bestRatio) {
      bestRatio = darkerRatio;
      bestLightness = darker;
    }
    if (lighterRatio > bestRatio) {
      bestRatio = lighterRatio;
      bestLightness = lighter;
    }
    if (bestRatio >= min) {
      break;
    }
  }

  return bestLightness;
};

const getReadableInk = (rgb) =>
  relativeLuminance(rgb) > 0.6 ? "#2b211a" : "#ffffff";

const nextNeedHue = () => {
  const goldenAngle = 137.508;
  const hue = (state.needHueSeed + state.needIndex * goldenAngle) % 360;
  state.needIndex += 1;
  return hue;
};

const getNeedColour = (label) => {
  if (!label) {
    return { bg: "#f3e9dc", ink: "#4a3a2b" };
  }
  if (state.needColours.has(label)) {
    return state.needColours.get(label);
  }
  const hue = nextNeedHue();
  const saturation = randomBetween(70, 88);
  const lightness = randomBetween(60, 74);
  const bg = hsl(hue, saturation, lightness);
  const ink = getReadableInk(hslToRgb(hue, saturation, lightness));
  const colour = { bg, ink };
  state.needColours.set(label, colour);
  return colour;
};

const THEME_VARS = [
  "--bg",
  "--bg-accent",
  "--bg-accent-2",
  "--card",
  "--card-accent",
  "--card-alt",
  "--card-alt-2",
  "--ink",
  "--muted",
  "--accent",
  "--accent-2",
  "--accent-soft",
  "--shadow",
  "--border-1",
  "--border-2",
  "--border-3",
  "--card-shadow",
  "--pill-bg",
  "--pill-ink",
  "--pill-status-bg",
  "--pill-status-ink",
  "--status-queue",
  "--status-repairing",
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const hsl = (hue, saturation, lightness) =>
  `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(
    lightness
  )}%)`;

const hsla = (hue, saturation, lightness, alpha) =>
  `hsla(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(
    lightness
  )}% / ${alpha})`;

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const pickScheme = () => {
  const options = ["complementary", "triadic", "analogous"];
  return options[Math.floor(Math.random() * options.length)];
};

const buildRandomPalette = () => {
  const baseHue = Math.floor(Math.random() * 360);
  const scheme = pickScheme();
  let accentHue = baseHue;
  if (scheme === "complementary") {
    accentHue = (baseHue + 180) % 360;
  } else if (scheme === "triadic") {
    accentHue = (baseHue + 120) % 360;
  } else {
    accentHue = (baseHue + 35) % 360;
  }
  const accent2Hue = (baseHue + 240) % 360;

  const bgH = baseHue;
  const bgS = randomBetween(20, 35);
  const bgL = randomBetween(88, 93);
  const bg = hsl(bgH, bgS, bgL);
  const bgRgb = hslToRgb(bgH, bgS, bgL);

  const bgAccent = hsl(baseHue, randomBetween(30, 45), randomBetween(80, 86));
  const bgAccent2 = hsl(accentHue, randomBetween(30, 50), randomBetween(75, 82));

  const cardH = baseHue;
  const cardS = randomBetween(15, 25);
  const cardL = randomBetween(94, 97);
  const card = hsl(cardH, cardS, cardL);
  const cardRgb = hslToRgb(cardH, cardS, cardL);
  const cardAccent = hsl(accentHue, randomBetween(30, 50), randomBetween(80, 88));
  const cardAlt = hsl(accent2Hue, randomBetween(25, 40), randomBetween(90, 94));

  const accentS = randomBetween(75, 90);
  const accentLBase = randomBetween(32, 45);
  const accentL = ensureContrastLightness(
    accentHue,
    accentS,
    accentLBase,
    cardRgb,
    3.2
  );
  const accent = hsl(accentHue, accentS, accentL);

  const accent2S = randomBetween(75, 90);
  const accent2LBase = randomBetween(34, 48);
  const accent2L = ensureContrastLightness(
    accent2Hue,
    accent2S,
    accent2LBase,
    cardRgb,
    3.2
  );
  const accent2 = hsl(accent2Hue, accent2S, accent2L);

  const ink = hsl(baseHue, randomBetween(10, 18), randomBetween(12, 18));
  const muted = hsl(baseHue, randomBetween(8, 14), randomBetween(32, 42));

  const statusQueueL = ensureContrastLightness(
    accentHue,
    85,
    40,
    cardRgb,
    3.6
  );
  const statusRepairingL = ensureContrastLightness(
    accent2Hue,
    85,
    40,
    cardRgb,
    3.6
  );

  return {
    "--bg": bg,
    "--bg-accent": bgAccent,
    "--bg-accent-2": bgAccent2,
    "--card": card,
    "--card-accent": cardAccent,
    "--card-alt": cardAlt,
    "--card-alt-2": cardAlt,
    "--ink": ink,
    "--muted": muted,
    "--accent": accent,
    "--accent-2": accent2,
    "--accent-soft": bgAccent,
    "--shadow": "0 20px 45px rgba(0, 0, 0, 0.16)",
    "--border-1": hsla(accentHue, 70, 45, 0.25),
    "--border-2": hsla(baseHue, 15, 30, 0.2),
    "--border-3": hsla(accent2Hue, 70, 45, 0.25),
    "--card-shadow": "0 12px 30px rgba(0, 0, 0, 0.12)",
    "--pill-bg": hsla(accentHue, 70, 55, 0.25),
    "--pill-ink": hsl(accentHue, 40, 30),
    "--pill-status-bg": hsla(accent2Hue, 70, 55, 0.25),
    "--pill-status-ink": hsl(accent2Hue, 45, 30),
    "--status-queue": hsl(accentHue, 85, statusQueueL),
    "--status-repairing": hsl(accent2Hue, 85, statusRepairingL),
  };
};

const applyThemeVariables = (vars) => {
  Object.entries(vars).forEach(([key, value]) => {
    document.body.style.setProperty(key, value);
  });
};

const clearThemeVariables = () => {
  THEME_VARS.forEach((key) => {
    document.body.style.removeProperty(key);
  });
};

const setStatus = (state, message = "") => {
  if (!elements.status) {
    return;
  }
  elements.status.classList.remove("is-loading", "is-hidden");
  if (elements.statusText) {
    elements.statusText.textContent = "";
  }
  if (state === "loading") {
    elements.status.classList.add("is-loading");
    elements.status.setAttribute("aria-label", "Updating");
    return;
  }
  if (state === "error") {
    elements.status.setAttribute("aria-label", "Connection issue");
    if (elements.statusText) {
      elements.statusText.textContent = message;
    }
    return;
  }
  elements.status.classList.add("is-hidden");
};

const formatTime = (date) =>
  date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

const renderEmpty = (target, message) => {
  target.innerHTML = "";
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = message;
  target.appendChild(item);
};

const renderCards = (target, cards, mapFn) => {
  target.innerHTML = "";
  if (!cards.length) {
    renderEmpty(target, "Nothing here yet.");
    return;
  }
  cards.forEach((card) => {
    target.appendChild(mapFn(card));
  });
};

const buildQueueCard = (ticket) => {
  const item = document.createElement("li");
  item.className = "card card-queue";
  const needs = Array.isArray(ticket.needs) ? ticket.needs : [];
  const needsMarkup = needs.length
    ? needs
        .map((need) => {
          const colour = getNeedColour(need);
          return `<span class="pill need-pill need-${slugify(
            need
          )}" style="--need-bg:${colour.bg}; --need-ink:${
            colour.ink
          }">${need}</span>`;
        })
        .join("")
    : `<span class="pill need-pill need-none">No specialisms listed</span>`;

  const itemName = ticket.item || "Untitled item";
  const ownerName = ticket.owner || "Unknown";
  item.innerHTML = `
    <div class="card-head">
      <p class="card-title">
        <span class="card-strong">${itemName}</span><span class="card-soft">brought by</span><span class="card-strong">${ownerName}</span>
      </p>
      <span class="pill pill-status">Queueing</span>
    </div>
    <div class="card-tags">
      ${needsMarkup}
    </div>
  `;
  return item;
};

const buildRepairingCard = (ticket) => {
  const item = document.createElement("li");
  item.className = "card card-repairing";
  const itemName = ticket.item || "Untitled item";
  const ownerName = ticket.owner || "Unknown";
  item.innerHTML = `
    <div class="card-head">
      <p class="card-title">
        <span class="card-strong">${itemName}</span><span class="card-soft">brought by</span><span class="card-strong">${ownerName}</span>
      </p>
      <span class="pill pill-status">Repairing</span>
    </div>
    <span class="pill">Repairer: <strong>${
      ticket.mender || "Unassigned"
    }</strong></span>
  `;
  return item;
};

const renderDashboard = (payload) => {
  const active = Array.isArray(payload.active) ? payload.active : [];
  const queue = active.filter(
    (ticket) => normaliseStatus(ticket.status) === "queueing"
  );
  const repairing = active.filter(
    (ticket) => normaliseStatus(ticket.status) === "repairing"
  );

  elements.repairedCount.textContent = payload.stats?.repairedToday ?? 0;
  elements.queueCount.textContent = queue.length;
  elements.repairingCount.textContent = repairing.length;

  renderCards(elements.queueList, queue, buildQueueCard);
  renderCards(elements.repairingList, repairing, buildRepairingCard);
};

const buildUrl = (endpoint) => {
  const url = new URL(endpoint);
  url.searchParams.set("_", Date.now().toString());
  return url.toString();
};

const fetchFromEndpoint = async (endpoint, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(buildUrl(endpoint), {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const fetchData = async () => {
  if (state.isFetching) {
    return;
  }
  state.isFetching = true;
  try {
    setStatus("loading");
    const endpoints = Array.isArray(CONFIG.endpoints)
      ? CONFIG.endpoints
      : [CONFIG.endpoint];
    let payload = null;
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        payload = await fetchFromEndpoint(endpoint, CONFIG.requestTimeoutMs);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!payload) {
      throw lastError || new Error("No response");
    }
    state.lastPayload = payload;
    state.lastUpdated = new Date();
    renderDashboard(payload);
    setStatus("idle");
    elements.timestamp.textContent = `Last updated ${formatTime(
      state.lastUpdated
    )}`;
  } catch (error) {
    const message =
      error instanceof Error
        ? `Connection issue (${error.message}) — showing last update.`
        : "Connection issue — showing last update.";
    setStatus("error", message);
    if (state.lastPayload) {
      renderDashboard(state.lastPayload);
    }
  } finally {
    state.isFetching = false;
  }
};

const init = () => {
  elements.title.textContent = CONFIG.title;
  if (CONFIG.logoUrl) {
    elements.logo.src = CONFIG.logoUrl;
    elements.logo.alt = `${CONFIG.title} logo`;
    elements.logo.style.display = "block";
    if (elements.logoIcon) {
      elements.logoIcon.style.display = "none";
    }
  } else {
    elements.logo.style.display = "none";
    if (elements.logoIcon) {
      elements.logoIcon.style.display = "grid";
    }
  }
  const applyTheme = () => {
    document.body.dataset.theme = "random-contrast";
    applyThemeVariables(buildRandomPalette());
    if (elements.themeToggle) {
      elements.themeToggle.textContent = "Randomise theme";
      elements.themeToggle.setAttribute("aria-label", "Randomise theme");
    }
  };
  if (elements.themeToggle) {
    elements.themeToggle.addEventListener("click", () => {
      applyTheme();
    });
  }
  applyTheme();
  fetchData();
  setInterval(fetchData, CONFIG.pollIntervalMs);
};

init();

