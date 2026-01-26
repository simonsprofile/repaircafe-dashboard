const CONFIG = {
  title: "Nunhead Repair Café",
  logoUrl: "",
  endpoint:
    "https://script.google.com/macros/s/AKfycbz3cVv4oZkfBiX550T8fW0nC1tHxH4tyEc9Bv4KnOqnzFUkX8FhhMCDtpSCYZ0i4vly/exec",
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
  statsCount: document.querySelector("[data-role='stats-count']"),
  statsList: document.querySelector("[data-role='stats-list']"),
  statsStart: document.querySelector("[data-role='stats-start']"),
  statsEnd: document.querySelector("[data-role='stats-end']"),
  statsSuccess: document.querySelector("[data-role='stats-success']"),
  statsPending: document.querySelector("[data-role='stats-pending']"),
  statsFailed: document.querySelector("[data-role='stats-failed']"),
  statsAvgWait: document.querySelector("[data-role='stats-avg-wait']"),
  statsAvgRepair: document.querySelector("[data-role='stats-avg-repair']"),
  statsAvgVisits: document.querySelector("[data-role='stats-avg-visits']"),
  statusChart: document.querySelector("[data-role='status-chart']"),
  statusLegend: document.querySelector("[data-role='status-legend']"),
  repairTypeChart: document.querySelector("[data-role='repair-type-chart']"),
  repairTypeLegend: document.querySelector("[data-role='repair-type-legend']"),
  podiumFast: [
    document.querySelector("[data-role='podium-fast-1']"),
    document.querySelector("[data-role='podium-fast-2']"),
    document.querySelector("[data-role='podium-fast-3']"),
  ],
  podiumThorough: [
    document.querySelector("[data-role='podium-thorough-1']"),
    document.querySelector("[data-role='podium-thorough-2']"),
    document.querySelector("[data-role='podium-thorough-3']"),
  ],
  podiumSuccess: [
    document.querySelector("[data-role='podium-success-1']"),
    document.querySelector("[data-role='podium-success-2']"),
    document.querySelector("[data-role='podium-success-3']"),
  ],
  podiumCafe: [
    document.querySelector("[data-role='podium-cafe-1']"),
    document.querySelector("[data-role='podium-cafe-2']"),
    document.querySelector("[data-role='podium-cafe-3']"),
  ],
  podiumBusy: [
    document.querySelector("[data-role='podium-busy-1']"),
    document.querySelector("[data-role='podium-busy-2']"),
    document.querySelector("[data-role='podium-busy-3']"),
  ],
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

const parseHslString = (value) => {
  if (!value) {
    return null;
  }
  const match = value
    .trim()
    .match(/hsla?\(([\d.]+)[ ,]+([\d.]+)%[ ,]+([\d.]+)%/i);
  if (!match) {
    return null;
  }
  return {
    h: Number(match[1]),
    s: Number(match[2]),
    l: Number(match[3]),
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
  "--ink-soft",
  "--score-soft",
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
  const inkSoftS = randomBetween(4, 10);
  const inkSoftLBase = randomBetween(40, 48);
  const inkSoftL = ensureContrastLightness(
    baseHue,
    inkSoftS,
    inkSoftLBase,
    cardRgb,
    2.6
  );
  const inkSoft = hsl(baseHue, inkSoftS, inkSoftL);
  const muted = hsl(baseHue, randomBetween(8, 14), randomBetween(32, 42));
  const scoreSoftS = randomBetween(10, 18);
  const scoreSoftLBase = randomBetween(66, 74);
  const scoreSoftL = ensureContrastLightness(
    accentHue,
    scoreSoftS,
    scoreSoftLBase,
    cardRgb,
    2.4
  );
  const scoreSoft = hsl(accentHue, scoreSoftS, scoreSoftL);

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
    "--ink-soft": inkSoft,
    "--score-soft": scoreSoft,
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
    <span class="pill">Mender: <strong>${
      ticket.mender || "Unassigned"
    }</strong></span>
  `;
  return item;
};

const renderDashboard = (payload) => {
  if (!elements.queueList || !elements.repairingList) {
    return;
  }
  const active = Array.isArray(payload.active) ? payload.active : [];
  const queue = active.filter(
    (ticket) => normaliseStatus(ticket.status) === "queueing"
  );
  const repairing = active.filter(
    (ticket) => normaliseStatus(ticket.status) === "repairing"
  );

  if (elements.repairedCount) {
    elements.repairedCount.textContent = payload.stats?.repairedToday ?? 0;
  }
  if (elements.queueCount) {
    elements.queueCount.textContent = queue.length;
  }
  if (elements.repairingCount) {
    elements.repairingCount.textContent = repairing.length;
  }

  renderCards(elements.queueList, queue, buildQueueCard);
  renderCards(elements.repairingList, repairing, buildRepairingCard);
};

const renderStats = (payload) => {
  if (
    !elements.statsSuccess ||
    !elements.statsPending ||
    !elements.statsFailed ||
    !elements.statsAvgWait ||
    !elements.statsAvgRepair ||
    !elements.statsAvgVisits
  ) {
    return;
  }
  const closed = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.closed)
    ? payload.closed
    : Array.isArray(payload.repairs)
    ? payload.repairs
    : Array.isArray(payload.items)
    ? payload.items
    : [];
  const range = getStatsRange();
  const completedItems = filterByDate(
    closed,
    (item) => item?.repairCompleted,
    range
  );
  const counts = completedItems.reduce(
    (acc, item) => {
      const status = normaliseStatus(item.status);
      if (status === "repaired") {
        acc.success += 1;
      } else if (status === "pending") {
        acc.pending += 1;
      } else if (status === "failed") {
        acc.failed += 1;
      }
      return acc;
    },
    { success: 0, pending: 0, failed: 0 }
  );
  elements.statsSuccess.textContent = counts.success;
  elements.statsPending.textContent = counts.pending;
  elements.statsFailed.textContent = counts.failed;

  const average = (values) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  const avgQueue = average(
    completedItems
      .map((item) => item?.totalQueueTime)
      .filter((value) => typeof value === "number" && value >= 0)
  );
  const avgRepair = average(
    completedItems
      .map((item) => item?.totalRepairTime)
      .filter((value) => typeof value === "number" && value >= 0)
  );
  const visitValues = completedItems
    .map((item) => item?.visits)
    .filter((value) => typeof value === "number" && value >= 0);
  let avgVisits = 0;
  if (visitValues.length) {
    avgVisits = average(visitValues);
  } else {
    const arrivalItems = filterByDate(
      closed,
      (item) => item?.arrival,
      range
    );
    if (range) {
      const dayMs = 24 * 60 * 60 * 1000;
      const dayCount =
        Math.floor((range.end.getTime() - range.start.getTime()) / dayMs) + 1;
      avgVisits = dayCount > 0 ? arrivalItems.length / dayCount : 0;
    } else {
      const byDay = new Map();
      arrivalItems.forEach((item) => {
        const date = new Date(item.arrival);
        if (Number.isNaN(date.getTime())) {
          return;
        }
        const key = toDateKey(date);
        byDay.set(key, (byDay.get(key) || 0) + 1);
      });
      const dayCounts = Array.from(byDay.values());
      avgVisits = average(dayCounts);
    }
  }
  const formatAvgCount = (value) => {
    if (!Number.isFinite(value)) {
      return "—";
    }
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };
  elements.statsAvgWait.textContent = formatDuration(avgQueue);
  elements.statsAvgRepair.textContent = formatDuration(avgRepair);
  elements.statsAvgVisits.textContent = formatAvgCount(avgVisits);

  renderStatusChart(counts);
  renderRepairTypeChart(completedItems);
  renderPodiums(completedItems, closed, range);
};

const formatDuration = (seconds) => {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) {
    return "—";
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${String(minutes).padStart(2, "0")}m`;
  }
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const buildPodiumEntry = (slot, name, value) => {
  if (!slot) {
    return;
  }
  const nameEl = slot.querySelector(".podium-name");
  const valueEl = slot.querySelector(".podium-value");
  if (nameEl) {
    nameEl.textContent = name || "—";
  }
  if (valueEl) {
    valueEl.textContent = value || "—";
  }
};

const renderPodium = (slots, entries, formatter) => {
  if (!Array.isArray(slots)) {
    return;
  }
  const [first, second, third] = slots;
  buildPodiumEntry(first, entries[0]?.name, formatter(entries[0]));
  buildPodiumEntry(second, entries[1]?.name, formatter(entries[1]));
  buildPodiumEntry(third, entries[2]?.name, formatter(entries[2]));
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const filterByDate = (items, accessor, range) => {
  const filtered = [];
  items.forEach((item) => {
    const raw = accessor(item);
    if (!raw) {
      return;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    if (range && (date < range.start || date > range.end)) {
      return;
    }
    filtered.push(item);
  });
  return filtered;
};

const renderPodiums = (completedItems, allItems, range) => {
  const byMender = new Map();
  completedItems.forEach((item) => {
    if (!Array.isArray(item.mender) || item.mender.length === 0) {
      return;
    }
    if (typeof item.totalRepairTime !== "number") {
      return;
    }
    item.mender.forEach((name) => {
      if (!name) {
        return;
      }
      const entry = byMender.get(name) || { total: 0, count: 0 };
      entry.total += item.totalRepairTime;
      entry.count += 1;
      byMender.set(name, entry);
    });
  });

  const menderAverages = Array.from(byMender.entries())
    .map(([name, entry]) => ({
      name,
      average: entry.count ? entry.total / entry.count : null,
    }))
    .filter((entry) => typeof entry.average === "number");

  const fastest = [...menderAverages].sort((a, b) => a.average - b.average).slice(0, 3);
  const slowest = [...menderAverages].sort((a, b) => b.average - a.average).slice(0, 3);

  renderPodium(elements.podiumFast, fastest, (entry) =>
    entry ? formatDuration(entry.average) : "—"
  );
  renderPodium(elements.podiumThorough, slowest, (entry) =>
    entry ? formatDuration(entry.average) : "—"
  );

  const successfulByMender = new Map();
  completedItems.forEach((item) => {
    if (normaliseStatus(item.status) !== "repaired") {
      return;
    }
    if (!Array.isArray(item.mender) || item.mender.length === 0) {
      return;
    }
    item.mender.forEach((name) => {
      if (!name) {
        return;
      }
      successfulByMender.set(name, (successfulByMender.get(name) || 0) + 1);
    });
  });

  const mostSuccessful = Array.from(successfulByMender.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  renderPodium(elements.podiumSuccess, mostSuccessful, (entry) =>
    entry ? `${entry.count} repairs` : "—"
  );

  const completedSuccess = completedItems.filter(
    (item) => normaliseStatus(item.status) === "repaired"
  );
  const byCompletedDay = new Map();
  completedSuccess.forEach((item) => {
    const date = new Date(item.repairCompleted);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    const key = toDateKey(date);
    byCompletedDay.set(key, (byCompletedDay.get(key) || 0) + 1);
  });

  const topDays = Array.from(byCompletedDay.entries())
    .map(([key, count]) => ({
      name: formatDateLabel(new Date(`${key}T00:00:00`)),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  renderPodium(elements.podiumCafe, topDays, (entry) =>
    entry ? `${entry.count} repairs` : "—"
  );

  const arrivalItems = filterByDate(allItems, (item) => item?.arrival, range);
  const byArrivalDay = new Map();
  arrivalItems.forEach((item) => {
    const date = new Date(item.arrival);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    const key = toDateKey(date);
    byArrivalDay.set(key, (byArrivalDay.get(key) || 0) + 1);
  });

  const busiest = Array.from(byArrivalDay.entries())
    .map(([key, count]) => ({
      name: formatDateLabel(new Date(`${key}T00:00:00`)),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  renderPodium(elements.podiumBusy, busiest, (entry) =>
    entry ? `${entry.count} repairs` : "—"
  );
};

const chartState = {
  status: null,
  repairType: null,
};

const buildStatusColors = () => [
  getComputedStyle(document.body).getPropertyValue("--success-color").trim() ||
    "#1b8f4a",
  getComputedStyle(document.body).getPropertyValue("--error-color").trim() ||
    "#b91c1c",
  getComputedStyle(document.body).getPropertyValue("--warning-color").trim() ||
    "#d97706",
];

const ensureStatusChart = () => {
  if (!elements.statusChart || typeof Chart === "undefined") {
    return null;
  }
  if (chartState.status) {
    return chartState.status;
  }
  const ctx = elements.statusChart.getContext("2d");
  chartState.status = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Repaired", "Failed", "Pending"],
      datasets: [
        {
          data: [0, 0, 0],
          backgroundColor: buildStatusColors(),
          borderColor: "transparent",
          borderWidth: 0,
          spacing: 6,
          borderRadius: 6,
          hoverOffset: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "42%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((sum, v) => sum + v, 0);
              const percent = total ? Math.round((value / total) * 100) : 0;
              return `${context.label}: ${percent}% (${value})`;
            },
          },
        },
      },
    },
    plugins: [
      {
        id: "sliceLabels",
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const total = dataset.data.reduce((sum, v) => sum + v, 0);
          ctx.save();
          ctx.fillStyle = getComputedStyle(document.body)
            .getPropertyValue("--ink")
            .trim();
          ctx.font = "700 12px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          meta.data.forEach((arc, index) => {
            const value = dataset.data[index];
            if (!total || !value) {
              return;
            }
            const percent = Math.round((value / total) * 100);
            if (percent < 6) {
              return;
            }
            const { x, y } = arc.getCenterPoint();
            ctx.fillText(`${percent}%`, x, y);
          });
          ctx.restore();
        },
      },
    ],
  });
  return chartState.status;
};

const renderStatusChart = (counts) => {
  if (!elements.statusChart || !elements.statusLegend) {
    return;
  }
  const chart = ensureStatusChart();
  if (!chart) {
    return;
  }
  const colors = buildStatusColors();
  chart.data.datasets[0].data = [
    counts.success,
    counts.failed,
    counts.pending,
  ];
  chart.data.datasets[0].backgroundColor = colors;
  chart.update();

  const labels = ["Repaired", "Failed", "Pending"];
  const values = [counts.success, counts.failed, counts.pending];
  elements.statusLegend.innerHTML = labels
    .map(
      (label, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="--legend-color:${colors[index]}"></span>
          <span>${label}</span>
          <span class="legend-value">${values[index]}</span>
        </div>
      `
    )
    .join("");
};

const buildDerivedChartColors = (count) => {
  const themeVars = [
    "--accent",
    "--accent-2",
    "--bg-accent",
    "--bg-accent-2",
    "--card-accent",
  ];
  const baseColors = themeVars
    .map((key) =>
      parseHslString(getComputedStyle(document.body).getPropertyValue(key))
    )
    .filter(Boolean);
  if (baseColors.length === 0) {
    baseColors.push({ h: Math.random() * 360, s: 70, l: 55 });
  }
  return Array.from({ length: count }, (_, index) => {
    const base = baseColors[index % baseColors.length];
    const hue = (base.h + index * 37) % 360;
    const saturation = clamp(base.s + randomBetween(-6, 12), 50, 82);
    const lightness = clamp(base.l + randomBetween(-12, 8), 38, 68);
    return hsl(hue, saturation, lightness);
  });
};

const ensureRepairTypeChart = () => {
  if (!elements.repairTypeChart || typeof Chart === "undefined") {
    return null;
  }
  if (chartState.repairType) {
    return chartState.repairType;
  }
  const ctx = elements.repairTypeChart.getContext("2d");
  chartState.repairType = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [],
          borderColor: "transparent",
          borderWidth: 0,
          spacing: 6,
          borderRadius: 6,
          hoverOffset: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "42%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.label}: ${context.raw || 0} repairs`,
          },
        },
      },
    },
  });
  return chartState.repairType;
};

const normaliseNeeds = (needs) => {
  if (Array.isArray(needs)) {
    return needs.map((need) => String(need || "").trim()).filter(Boolean);
  }
  if (typeof needs === "string") {
    return needs
      .split(",")
      .map((need) => need.trim())
      .filter(Boolean);
  }
  return [];
};

const renderRepairTypeChart = (items) => {
  if (!elements.repairTypeChart || !elements.repairTypeLegend) {
    return;
  }
  const chart = ensureRepairTypeChart();
  if (!chart) {
    return;
  }
  const counts = new Map();
  items.forEach((item) => {
    normaliseNeeds(item?.needs).forEach((need) => {
      counts.set(need, (counts.get(need) || 0) + 1);
    });
  });

  const entries = Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const labels = entries.map((entry) => entry.label);
  const values = entries.map((entry) => entry.value);
  const colors = buildDerivedChartColors(labels.length);

  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.data.datasets[0].backgroundColor = colors;
  chart.update();

  if (labels.length === 0) {
    elements.repairTypeLegend.innerHTML = `
      <div class="legend-item">
        <span>No data in range</span>
      </div>
    `;
    return;
  }

  elements.repairTypeLegend.innerHTML = labels
    .map(
      (label, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="--legend-color:${colors[index]}"></span>
          <span>${label}</span>
          <span class="legend-value">${values[index]}</span>
        </div>
      `
    )
    .join("");
};

const pageAction = document.body.dataset.action || "open_repairs";
const pollIntervalMs =
  pageAction === "closed_repairs" ? 5 * 60 * 1000 : CONFIG.pollIntervalMs;

const parseDateInput = (value) => {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const getStatsRange = () => {
  if (!elements.statsStart || !elements.statsEnd) {
    return null;
  }
  const start = parseDateInput(elements.statsStart.value);
  const end = parseDateInput(elements.statsEnd.value);
  if (!start || !end) {
    return null;
  }
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);
  return { start, end: endOfDay };
};

const buildUrl = (endpoint, action) => {
  const url = new URL(endpoint);
  url.searchParams.set("action", action);
  url.searchParams.set("_", Date.now().toString());
  return url.toString();
};

const fetchFromEndpoint = async (endpoint, action, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(buildUrl(endpoint, action), {
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
    const payload = await fetchFromEndpoint(
      CONFIG.endpoint,
      pageAction,
      CONFIG.requestTimeoutMs
    );
    state.lastPayload = payload;
    state.lastUpdated = new Date();
    renderDashboard(payload);
    renderStats(payload);
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
      renderStats(state.lastPayload);
    }
  } finally {
    state.isFetching = false;
  }
};

const refreshCharts = () => {
  if (!state.lastPayload) {
    return;
  }
  renderStats(state.lastPayload);
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
      elements.themeToggle.setAttribute("aria-label", "Randomise theme");
    }
    refreshCharts();
  };
  if (elements.statsStart && elements.statsEnd) {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const toInputValue = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    elements.statsStart.value = toInputValue(startOfYear);
    elements.statsEnd.value = toInputValue(today);
    const handleRangeChange = () => {
      if (state.lastPayload) {
        renderStats(state.lastPayload);
      }
    };
    elements.statsStart.addEventListener("change", handleRangeChange);
    elements.statsEnd.addEventListener("change", handleRangeChange);
  }
  if (elements.themeToggle) {
    elements.themeToggle.addEventListener("click", () => {
      applyTheme();
    });
  }
  applyTheme();
  fetchData();
  setInterval(fetchData, pollIntervalMs);
};

init();

