const state = {
  puzzle: null,
  direction: "across",
  activeEntry: null,
  activeCell: null,
  tab: "across",
  values: {}
};

const boardEl = document.querySelector("#board");
const cluesEl = document.querySelector("#clues");
const activeClueEl = document.querySelector("#active-clue");
const dirToggle = document.querySelector("#dir-toggle");
const feedbackEl = document.querySelector("#feedback");
const puzzles = [
  { date: "2026-07-17", label: "17/07/2026 · מקור ראשון · דקל בנו", file: "puzzles/2026-07-17.json" },
  { date: "2026-07-10", label: "10/07/2026 · מקור ראשון · דקל בנו", file: "puzzles/2026-07-10.json" },
  { date: "2026-07-03", label: "03/07/2026 · מקור ראשון · דקל בנו", file: "puzzles/2026-07-03.json" }
];
let storageKey = "";
const finalLetters = { ם: "מ", ן: "נ", ף: "פ", ץ: "צ", ך: "כ" };
let compactLocked = false;

const keyOf = ([row, col]) => `${row},${col}`;

async function boot() {
  const requestedDate = new URLSearchParams(window.location.search).get("date");
  const selected = puzzles.find((puzzle) => puzzle.date === requestedDate) || puzzles[0];
  state.puzzle = await fetch(selected.file).then((res) => res.json());
  storageKey = state.puzzle.id;
  prepareWordBreaks();
  state.values = JSON.parse(localStorage.getItem(storageKey) || "{}");
  renderBoard();
  renderClues();
  renderPuzzleMeta();
  renderArchive();
  wireControls();
  selectEntry("across", 1, [0, 10]);
}

function renderPuzzleMeta() {
  const sourceImage = document.querySelector("#source-image");
  const sourceLink = document.querySelector("#source-link");
  sourceImage.src = state.puzzle.imageUrl;
  sourceLink.href = state.puzzle.pdfUrl || state.puzzle.imageUrl;
  sourceLink.textContent = state.puzzle.pdfUrl ? "פתיחת PDF" : "פתיחת תמונה";
}

function renderArchive() {
  const archiveList = document.querySelector("#archive-list");
  archiveList.innerHTML = "";
  puzzles.forEach((puzzle, index) => {
    const link = document.createElement("a");
    link.href = index === 0 ? "./" : `./?date=${puzzle.date}`;
    link.textContent = puzzle.label;
    archiveList.append(link);
  });
}

function renderBoard() {
  boardEl.innerHTML = "";
  state.puzzle.rows.forEach((row, rowIndex) => {
    [...row].forEach((char, colIndex) => {
      const cell = document.createElement("div");
      const id = `${rowIndex},${colIndex}`;
      cell.className = char === "#" ? "cell black" : "cell";
      cell.dataset.cell = id;

      const number = state.puzzle.numbers[id];
      if (number) {
        const num = document.createElement("span");
        num.className = "num";
        num.textContent = number;
        cell.append(num);
      }

      if (char !== "#") {
        const input = document.createElement("input");
        input.inputMode = "text";
        input.maxLength = 1;
        input.autocomplete = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        input.setAttribute("autocorrect", "off");
        input.setAttribute("enterkeyhint", "next");
        input.value = state.values[id] || "";
        input.setAttribute("aria-label", `שורה ${rowIndex + 1}, עמודה ${colIndex + 1}`);
        input.addEventListener("focus", () => handleCellFocus(rowIndex, colIndex));
        input.addEventListener("input", (event) => handleInput(event, rowIndex, colIndex));
        input.addEventListener("keydown", (event) => handleKeydown(event, rowIndex, colIndex));
        cell.append(input);
      }

      boardEl.append(cell);
    });
  });
  applyWordBreaks();
}

function prepareWordBreaks() {
  ["across", "down"].forEach((direction) => {
    state.puzzle.entries[direction].forEach((entry) => {
      entry.wordBreaks = getWordBreaks(entry.clue, entry.cells.length);
    });
  });
}

function getWordBreaks(clue, length) {
  const match = clue.match(/\(([\d,\s]+)\)\s*$/);
  if (!match || !match[1].includes(",")) return [];
  const visualParts = match[1]
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0);
  if (visualParts.length < 2) return [];
  const logicalParts = [...visualParts].reverse();
  const total = logicalParts.reduce((sum, part) => sum + part, 0);
  if (total !== length) return [];
  const breaks = [];
  logicalParts.slice(0, -1).reduce((sum, part) => {
    const next = sum + part;
    breaks.push(next);
    return next;
  }, 0);
  return breaks;
}

function applyWordBreaks() {
  document.querySelectorAll(".word-break-left,.word-break-right,.word-break-top,.word-break-bottom").forEach((cell) => {
    cell.classList.remove("word-break-left", "word-break-right", "word-break-top", "word-break-bottom");
  });
  ["across", "down"].forEach((direction) => {
    state.puzzle.entries[direction].forEach((entry) => {
      entry.wordBreaks?.forEach((breakIndex) => {
        const before = entry.cells[breakIndex - 1];
        const after = entry.cells[breakIndex];
        if (!before || !after) return;
        const beforeEl = document.querySelector(`[data-cell="${keyOf(before)}"]`);
        const afterEl = document.querySelector(`[data-cell="${keyOf(after)}"]`);
        if (!beforeEl || !afterEl) return;
        if (direction === "across") {
          beforeEl.classList.add(after[1] < before[1] ? "word-break-left" : "word-break-right");
          afterEl.classList.add(after[1] < before[1] ? "word-break-right" : "word-break-left");
        } else {
          beforeEl.classList.add(after[0] > before[0] ? "word-break-bottom" : "word-break-top");
          afterEl.classList.add(after[0] > before[0] ? "word-break-top" : "word-break-bottom");
        }
      });
    });
  });
}

function renderClues() {
  cluesEl.innerHTML = "";
  state.puzzle.entries[state.tab].forEach((entry) => {
    const button = document.createElement("button");
    button.className = "clue";
    button.type = "button";
    button.dataset.direction = state.tab;
    button.dataset.number = entry.number;
    button.textContent = `${entry.number}. ${entry.clue}`;
    button.addEventListener("click", () => selectEntry(state.tab, entry.number, entry.cells[0]));
    cluesEl.append(button);
  });
  highlight();
}

function wireControls() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el === tab));
      renderClues();
    });
  });

  dirToggle.addEventListener("click", () => {
    state.direction = state.direction === "across" ? "down" : "across";
    dirToggle.textContent = state.direction === "across" ? "מאוזן" : "מאונך";
    dirToggle.dataset.compact = state.direction === "across" ? "↔" : "↕";
    if (state.activeCell) {
      const entry = entryForCell(state.activeCell, state.direction);
      if (entry) selectEntry(state.direction, entry.number, state.activeCell);
    }
  });

  document.querySelector("#next-clue").addEventListener("click", () => moveClue(1));
  document.querySelector("#prev-clue").addEventListener("click", () => moveClue(-1));
  document.querySelector("#clear-entry").addEventListener("click", clearEntry);
  document.querySelector("#check-entry").addEventListener("click", checkEntry);
  document.querySelector("#check-all").addEventListener("click", checkAll);
  document.querySelector("#full-view").addEventListener("click", leaveCompactView);

  const dialog = document.querySelector("#source-dialog");
  document.querySelector("#toggle-source").addEventListener("click", () => dialog.showModal());
  document.querySelector("#archive-button").addEventListener("click", () => {
    document.querySelector("#archive-dialog").showModal();
  });
  document.querySelector("#share-button").addEventListener("click", sharePuzzle);
  setupKeyboardViewport();
}

function handleCellFocus(row, col) {
  const cell = [row, col];
  const preferred = entryForCell(cell, state.direction) || entryForCell(cell, opposite(state.direction));
  if (preferred) selectEntry(state.direction, preferred.number, cell);
}

function handleInput(event, row, col) {
  const value = normalizeLetter(event.target.value.replace(/\s/g, "").slice(-1));
  event.target.value = value;
  state.values[`${row},${col}`] = value;
  localStorage.setItem(storageKey, JSON.stringify(state.values));
  clearMarks();
  if (value) moveWithinEntry(1);
}

function handleKeydown(event, row, col) {
  if (event.key === "Backspace" && !event.target.value) {
    event.preventDefault();
    moveWithinEntry(-1);
    return;
  }
  const arrows = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0]
  };
  if (arrows[event.key]) {
    event.preventDefault();
    focusCell(row + arrows[event.key][0], col + arrows[event.key][1]);
  }
}

function selectEntry(direction, number, activeCell) {
  state.direction = direction;
  state.activeEntry = state.puzzle.entries[direction].find((entry) => entry.number === number);
  state.activeCell = activeCell;
  dirToggle.textContent = direction === "across" ? "מאוזן" : "מאונך";
  dirToggle.dataset.compact = direction === "across" ? "↔" : "↕";
  activeClueEl.textContent = `${direction === "across" ? "מאוזן" : "מאונך"} ${state.activeEntry.number}. ${state.activeEntry.clue}`;
  setFeedback("");
  highlight();
  focusCell(activeCell[0], activeCell[1]);
}

function entryForCell(cell, direction) {
  return state.puzzle.entries[direction].find((entry) =>
    entry.cells.some((entryCell) => keyOf(entryCell) === keyOf(cell))
  );
}

function highlight() {
  document.querySelectorAll(".cell").forEach((cell) => {
    cell.classList.remove("in-entry", "active");
  });
  document.querySelectorAll(".clue").forEach((clue) => {
    clue.classList.toggle(
      "active",
      state.activeEntry &&
        clue.dataset.direction === state.direction &&
        Number(clue.dataset.number) === state.activeEntry.number
    );
  });
  if (!state.activeEntry) return;
  state.activeEntry.cells.forEach((coords) => {
    document.querySelector(`[data-cell="${keyOf(coords)}"]`)?.classList.add("in-entry");
  });
  if (state.activeCell) {
    document.querySelector(`[data-cell="${keyOf(state.activeCell)}"]`)?.classList.add("active");
  }
}

function normalizeLetter(value) {
  return finalLetters[value] || value;
}

function normalizeAnswer(value) {
  return [...(value || "")]
    .map((char) => normalizeLetter(char))
    .join("")
    .replace(/[^\u0590-\u05ffA-Za-z]/g, "")
    .toLowerCase();
}

function entryValue(entry) {
  return entry.cells.map((cell) => normalizeLetter(state.values[keyOf(cell)] || "")).join("");
}

function checkEntry() {
  if (!state.activeEntry) return;
  if (!state.activeEntry.answer) {
    setFeedback("עדיין לא הועלו פתרונות לאתר.", "bad");
    return;
  }
  const typed = normalizeAnswer(entryValue(state.activeEntry));
  const expected = normalizeAnswer(state.activeEntry.answer);
  markEntry(state.activeEntry, typed === expected, typed.length === expected.length);
  if (!typed) {
    setFeedback("עוד לא מילאת את המילה הזו.", "bad");
  } else if (typed.length < expected.length) {
    setFeedback("המילה עדיין לא מלאה.", "bad");
  } else if (typed === expected) {
    setFeedback("נכון.", "good");
  } else {
    setFeedback("עוד לא.", "bad");
  }
}

function checkAll() {
  const allEntries = [...state.puzzle.entries.across, ...state.puzzle.entries.down].filter((entry) => entry.answer);
  if (!allEntries.length) {
    setFeedback("עדיין לא הועלו פתרונות לאתר.", "bad");
    return;
  }
  let correct = 0;
  let complete = 0;
  allEntries.forEach((entry) => {
    const typed = normalizeAnswer(entryValue(entry));
    const expected = normalizeAnswer(entry.answer);
    if (typed.length === expected.length) complete += 1;
    if (typed === expected) correct += 1;
    markEntry(entry, typed === expected, typed.length === expected.length);
  });
  setFeedback(`${correct} נכונות מתוך ${allEntries.length}. ${complete < allEntries.length ? "יש מילים שעדיין לא מלאות." : ""}`, correct === allEntries.length ? "good" : "bad");
}

function markEntry(entry, isCorrect, isComplete) {
  entry.cells.forEach((cell) => {
    const el = document.querySelector(`[data-cell="${keyOf(cell)}"]`);
    if (!el) return;
    el.classList.toggle("correct", isCorrect);
    el.classList.toggle("wrong", !isCorrect && isComplete);
  });
}

function clearMarks() {
  document.querySelectorAll(".cell.correct,.cell.wrong").forEach((cell) => {
    cell.classList.remove("correct", "wrong");
  });
  setFeedback("");
}

function setFeedback(message, type = "") {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback ${type}`.trim();
}

async function sharePuzzle() {
  const shareData = {
    title: state.puzzle.title,
    text: "תשבץ היגיון מקור ראשון",
    url: location.href.split("?")[0]
  };
  if (navigator.share) {
    await navigator.share(shareData).catch(() => {});
    return;
  }
  await navigator.clipboard?.writeText(location.href);
  setFeedback("הקישור הועתק.", "good");
}

function setupKeyboardViewport() {
  const root = document.documentElement;
  const update = () => {
    const visualHeight = window.visualViewport?.height || window.innerHeight;
    root.style.setProperty("--vvh", `${visualHeight}px`);
    const cellFocused = document.activeElement?.matches(".cell input");
    if (cellFocused) compactLocked = true;
    const keyboardOpen = window.innerWidth <= 760 && (cellFocused || compactLocked);
    document.body.classList.toggle("keyboard-open", keyboardOpen);
  };
  update();
  window.visualViewport?.addEventListener("resize", update);
  window.addEventListener("resize", update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", () => window.setTimeout(update, 80));
}

function leaveCompactView() {
  compactLocked = false;
  document.activeElement?.blur();
  document.body.classList.remove("keyboard-open");
}

function moveWithinEntry(delta) {
  if (!state.activeEntry || !state.activeCell) return;
  const index = state.activeEntry.cells.findIndex((cell) => keyOf(cell) === keyOf(state.activeCell));
  const next = state.activeEntry.cells[index + delta];
  if (next) focusCell(next[0], next[1]);
}

function moveClue(delta) {
  if (!state.activeEntry) return;
  const entries = state.puzzle.entries[state.direction];
  const index = entries.findIndex((entry) => entry.number === state.activeEntry.number);
  const next = entries[(index + delta + entries.length) % entries.length];
  selectEntry(state.direction, next.number, next.cells[0]);
}

function clearEntry() {
  if (!state.activeEntry) return;
  state.activeEntry.cells.forEach((cell) => {
    delete state.values[keyOf(cell)];
    const input = document.querySelector(`[data-cell="${keyOf(cell)}"] input`);
    if (input) input.value = "";
  });
  localStorage.setItem(storageKey, JSON.stringify(state.values));
  focusCell(state.activeEntry.cells[0][0], state.activeEntry.cells[0][1]);
}

function focusCell(row, col) {
  const input = document.querySelector(`[data-cell="${row},${col}"] input`);
  if (!input) return;
  compactLocked = true;
  state.activeCell = [row, col];
  input.focus({ preventScroll: true });
  highlight();
}

function opposite(direction) {
  return direction === "across" ? "down" : "across";
}

boot();
