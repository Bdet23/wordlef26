// Fourdle for the web: guess four words at once.
// Every guess is played on all four boards. A board stops taking guesses once
// its word is found. Solve all four within MAX_GUESSES to win.
// Loads words.txt from the same directory as this page.

"use strict";

// ------------------------------------------------------------------ engine
// (same scoring as the Python Wordle)

const WORD_LENGTH = 5;
const NUM_BOARDS = 4;
const MAX_GUESSES = 9;
const STRICT_WORDS = true; // Reject guesses that are not in WORDS

const GREEN = "G";
const YELLOW = "Y";
const GRAY = ".";

let WORDS = [];
let WORD_SET = new Set();

/** Return a 5-char string of G/Y/. for guess against target. */
function scoreGuess(guess, target) {
  const result = new Array(WORD_LENGTH).fill(GRAY);
  const remaining = target.split("");
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = GREEN;
      remaining[i] = null;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === GREEN) continue;
    const j = remaining.indexOf(guess[i]);
    if (j !== -1) {
      result[i] = YELLOW;
      remaining[j] = null;
    }
  }
  return result.join("");
}

/** Pick NUM_BOARDS different random words. */
function pickTargets() {
  const picked = new Set();
  while (picked.size < NUM_BOARDS) {
    picked.add(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return [...picked];
}

class FourdleGame {
  constructor(targets) {
    this.targets = targets || pickTargets();
    this.guesses = [];
    // Index of the guess that solved each board, or -1 if not solved yet.
    this.solvedAt = new Array(NUM_BOARDS).fill(-1);
  }

  solved(board) {
    return this.solvedAt[board] !== -1;
  }

  won() {
    return this.solvedAt.every((i) => i !== -1);
  }

  over() {
    return this.won() || this.guesses.length >= MAX_GUESSES;
  }

  validate(guess) {
    if (this.over()) return "Game over";
    if (guess.length !== WORD_LENGTH || !/^[a-z]+$/.test(guess)) {
      return "Need " + WORD_LENGTH + " letters";
    }
    if (STRICT_WORDS && !WORD_SET.has(guess)) return "Not in word list";
    return null;
  }

  guess(guess) {
    const error = this.validate(guess);
    if (error) return error;
    this.guesses.push(guess);
    for (let b = 0; b < NUM_BOARDS; b++) {
      if (!this.solved(b) && guess === this.targets[b]) {
        this.solvedAt[b] = this.guesses.length - 1;
      }
    }
    return null;
  }

  /** List of [guess, score] rows shown on one board. */
  boardHistory(board) {
    const rows = this.solved(board)
      ? this.guesses.slice(0, this.solvedAt[board] + 1)
      : this.guesses;
    return rows.map((word) => [word, scoreGuess(word, this.targets[board])]);
  }
}

// ------------------------------------------------------------------ UI

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
];

// CSS class for each score letter ("." is not a valid class name)
const SCORE_CLASS = { [GREEN]: "G", [YELLOW]: "Y", [GRAY]: "gray" };
const RANK = { [GREEN]: 3, [YELLOW]: 2, [GRAY]: 1 };
const RANK_CLASS = { 3: "G", 2: "Y", 1: "gray" };

class FourdleApp {
  constructor() {
    this.boardsEl = document.getElementById("boards");
    this.messageEl = document.getElementById("message");
    this.keyboardEl = document.getElementById("keyboard");

    this.boards = this.buildBoards();
    this.keys = this.buildKeyboard();

    document.getElementById("new-game").addEventListener("click", (e) => {
      e.currentTarget.blur(); // so Enter doesn't re-press the button
      this.newGame();
    });
    document.addEventListener("keydown", (e) => this.onKeydown(e));

    this.newGame();
  }

  buildBoards() {
    const boards = [];
    for (let b = 0; b < NUM_BOARDS; b++) {
      const boardEl = document.createElement("div");
      boardEl.className = "board";
      boardEl.setAttribute("aria-label", "Board " + (b + 1));
      const tiles = [];
      for (let row = 0; row < MAX_GUESSES; row++) {
        const rowTiles = [];
        for (let col = 0; col < WORD_LENGTH; col++) {
          const tile = document.createElement("div");
          tile.className = "tile";
          boardEl.appendChild(tile);
          rowTiles.push(tile);
        }
        tiles.push(rowTiles);
      }
      this.boardsEl.appendChild(boardEl);
      boards.push({ el: boardEl, tiles });
    }
    return boards;
  }

  buildKeyboard() {
    const keys = {};
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement("div");
      rowEl.className = "key-row";
      for (const label of row) {
        const key = document.createElement("button");
        key.type = "button";
        key.className = label.length > 1 ? "key wide" : "key";
        const quads = [];
        if (label.length === 1) {
          // One colored quarter per board, laid out like the boards (2x2).
          const quadsEl = document.createElement("span");
          quadsEl.className = "quads";
          for (let b = 0; b < NUM_BOARDS; b++) {
            const quad = document.createElement("i");
            quadsEl.appendChild(quad);
            quads.push(quad);
          }
          key.appendChild(quadsEl);
        }
        const text = document.createElement("span");
        text.className = "label";
        text.textContent = label;
        key.appendChild(text);
        key.addEventListener("click", (e) => {
          e.currentTarget.blur();
          this.press(label);
        });
        rowEl.appendChild(key);
        keys[label] = { el: key, quads };
      }
      this.keyboardEl.appendChild(rowEl);
    }
    return keys;
  }

  newGame() {
    this.game = new FourdleGame();
    this.current = "";
    this.message = "";
    this.draw();
  }

  /** For each board, map letter -> best rank seen on that board. */
  letterStatus() {
    const perBoard = [];
    for (let b = 0; b < NUM_BOARDS; b++) {
      const status = {};
      for (const [word, score] of this.game.boardHistory(b)) {
        for (let i = 0; i < WORD_LENGTH; i++) {
          status[word[i]] = Math.max(status[word[i]] || 0, RANK[score[i]]);
        }
      }
      perBoard.push(status);
    }
    return perBoard;
  }

  press(label) {
    if (this.game.over()) return;
    if (label === "DEL") {
      this.current = this.current.slice(0, -1);
      this.message = "";
    } else if (label === "ENTER") {
      const error = this.game.guess(this.current);
      if (error) {
        this.message = error;
      } else {
        this.current = "";
        const n = this.game.guesses.length;
        if (this.game.won()) {
          this.message = "Solved all four in " + n + "!";
        } else if (this.game.over()) {
          const missed = this.game.targets
            .filter((_, b) => !this.game.solved(b))
            .map((w) => w.toUpperCase());
          this.message = "Missed: " + missed.join(", ");
        } else {
          const left = MAX_GUESSES - n;
          this.message = left + (left === 1 ? " guess left" : " guesses left");
        }
      }
    } else if (this.current.length < WORD_LENGTH) {
      this.current += label.toLowerCase();
      this.message = "";
    }
    this.draw();
  }

  onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      this.press("DEL");
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.press("ENTER");
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      this.press(e.key.toUpperCase());
    }
  }

  draw() {
    const over = this.game.over();

    // Boards
    for (let b = 0; b < NUM_BOARDS; b++) {
      const { el, tiles } = this.boards[b];
      const history = this.game.boardHistory(b);
      const solved = this.game.solved(b);
      el.classList.toggle("solved", solved);
      el.classList.toggle("failed", over && !solved);
      for (let row = 0; row < MAX_GUESSES; row++) {
        for (let col = 0; col < WORD_LENGTH; col++) {
          const tile = tiles[row][col];
          if (row < history.length) {
            const [word, score] = history[row];
            tile.className = "tile " + SCORE_CLASS[score[col]];
            tile.textContent = word[col];
          } else if (!solved && !over && row === history.length &&
                     col < this.current.length) {
            tile.className = "tile typed";
            tile.textContent = this.current[col];
          } else {
            tile.className = "tile";
            tile.textContent = "";
          }
        }
      }
    }

    // Status message
    this.messageEl.textContent = this.message;

    // Keyboard tracker: each key shows one quarter per board.
    // Solved boards no longer matter, so their quarter goes back to plain.
    const status = this.letterStatus();
    for (const [label, { el, quads }] of Object.entries(this.keys)) {
      if (!quads.length) continue;
      const letter = label.toLowerCase();
      let used = false;
      quads.forEach((quad, b) => {
        const cls = this.game.solved(b) ? "" : RANK_CLASS[status[b][letter]] || "";
        quad.className = cls;
        if (cls) used = true;
      });
      el.classList.toggle("used", used);
    }
  }
}

// ------------------------------------------------------------------ music

const MUSIC_CLIPS = [
  "audio/claw-ingame-part1.mp3",
  "audio/claw-ingame-part2.mp3",
];

class Music {
  constructor(button) {
    const clip = MUSIC_CLIPS[Math.floor(Math.random() * MUSIC_CLIPS.length)];
    this.audio = new Audio(clip);
    this.audio.loop = true;
    this.button = button;
    this.started = false;

    // Try to play right away. Most browsers block sound until the player
    // clicks, taps or presses a key, so if that fails, start on the first
    // interaction instead.
    const start = () => {
      if (this.started) return;
      this.started = true;
      this.audio.play().catch(() => { this.started = false; });
    };
    start();
    for (const type of ["keydown", "pointerdown", "pointerup", "touchend", "click"]) {
      document.addEventListener(type, start);
    }

    button.addEventListener("click", (e) => {
      e.currentTarget.blur();
      this.audio.muted = !this.audio.muted;
      this.updateButton();
    });
    this.updateButton();
  }

  updateButton() {
    this.button.textContent = this.audio.muted ? "Music: off" : "Music: on";
    this.button.setAttribute("aria-pressed", String(!this.audio.muted));
  }
}

new Music(document.getElementById("music"));

// ------------------------------------------------------------------ startup

async function loadWords() {
  const response = await fetch("words.txt");
  if (!response.ok) throw new Error("HTTP " + response.status);
  const text = await response.text();
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0);
}

loadWords()
  .then((words) => {
    WORDS = words;
    WORD_SET = new Set(words);
    new FourdleApp();
  })
  .catch((err) => {
    document.getElementById("message").textContent =
      "Could not load words.txt (" + err.message + ")";
  });
