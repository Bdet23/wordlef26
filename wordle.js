// 32dle for the web: guess 32 words at once.
// Every guess is played on all 32 boards. A board stops taking guesses once
// its word is found. Solve all of them within MAX_GUESSES to win.
// Loads words.txt from the same directory as this page.

"use strict";

// ------------------------------------------------------------------ engine
// (same scoring as the Python Wordle)

const WORD_LENGTH = 5;
const NUM_BOARDS = 32;
const MAX_GUESSES = NUM_BOARDS + 5; // 37
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

class MultiGame {
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

class MultiApp {
  constructor() {
    this.boardsEl = document.getElementById("boards");
    if (!this.boardsEl) {
      // Original Wordle page: swap its single grid for the boards container.
      this.boardsEl = document.createElement("section");
      this.boardsEl.id = "boards";
      this.boardsEl.className = "boards";
      const grid = document.getElementById("grid");
      if (grid) grid.replaceWith(this.boardsEl);
      else document.querySelector(".app").prepend(this.boardsEl);
    }
    this.messageEl = document.getElementById("message");
    // The page may be an older cached copy without these elements (browsers
    // can keep index.html for a few minutes after an update), so create
    // anything that is missing instead of crashing.
    this.statusEl = document.getElementById("status");
    if (!this.statusEl) {
      this.statusEl = document.createElement("p");
      this.statusEl.id = "status";
      this.statusEl.className = "status";
      document.querySelector(".controls").appendChild(this.statusEl);
    }
    const hint = document.querySelector(".hint");
    if (hint) {
      hint.textContent = "Find all " + NUM_BOARDS + " words in " + MAX_GUESSES +
        " guesses. Each guess goes on every board.";
    }
    document.title = NUM_BOARDS + "dle";
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

  makeRow(parent) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    const tiles = [];
    for (let col = 0; col < WORD_LENGTH; col++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      rowEl.appendChild(tile);
      tiles.push(tile);
    }
    parent.appendChild(rowEl);
    return { el: rowEl, tiles };
  }

  buildBoards() {
    const boards = [];
    for (let b = 0; b < NUM_BOARDS; b++) {
      const boardEl = document.createElement("div");
      boardEl.className = "board";
      boardEl.setAttribute("aria-label", "Board " + (b + 1));
      const rows = [];
      for (let r = 0; r < MAX_GUESSES; r++) rows.push(this.makeRow(boardEl));
      // Extra row that shows the answer if the board is not solved in time.
      const answer = this.makeRow(boardEl);
      answer.el.classList.add("answer");
      this.boardsEl.appendChild(boardEl);
      boards.push({ el: boardEl, rows, answer });
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
        key.textContent = label;
        key.addEventListener("click", (e) => {
          e.currentTarget.blur();
          this.press(label);
        });
        rowEl.appendChild(key);
        keys[label] = key;
      }
      this.keyboardEl.appendChild(rowEl);
    }
    return keys;
  }

  newGame() {
    this.game = new MultiGame();
    this.current = "";
    this.message = "";
    this.draw();
    window.scrollTo(0, 0);
  }

  /**
   * Letters that cannot be in any unsolved board's word: each unsolved board
   * has scored the letter gray and never green or yellow.
   */
  deadLetters() {
    const dead = new Set("abcdefghijklmnopqrstuvwxyz");
    for (let b = 0; b < NUM_BOARDS; b++) {
      if (this.game.solved(b)) continue;
      const seenGray = new Set();
      const seenHit = new Set();
      for (const [word, score] of this.game.boardHistory(b)) {
        for (let i = 0; i < WORD_LENGTH; i++) {
          (score[i] === GRAY ? seenGray : seenHit).add(word[i]);
        }
      }
      for (const letter of [...dead]) {
        if (!seenGray.has(letter) || seenHit.has(letter)) dead.delete(letter);
      }
    }
    return dead;
  }

  press(label) {
    if (this.game.over()) return;
    if (label === "DEL") {
      this.current = this.current.slice(0, -1);
      this.message = "";
    } else if (label === "ENTER") {
      const before = this.solvedCount();
      const error = this.game.guess(this.current);
      if (error) {
        this.message = error;
      } else {
        this.current = "";
        const n = this.game.guesses.length;
        const found = this.solvedCount() - before;
        if (this.game.won()) {
          this.message = "Solved all " + NUM_BOARDS + " in " + n + "!";
        } else if (this.game.over()) {
          this.message = "Out of guesses. Answers shown in red.";
        } else if (found) {
          this.message = "Got one!";
        } else {
          this.message = "";
        }
      }
    } else if (this.current.length < WORD_LENGTH) {
      this.current += label.toLowerCase();
      this.message = "";
    }
    this.draw();
  }

  solvedCount() {
    return this.game.solvedAt.filter((i) => i !== -1).length;
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

    // Boards: show the guessed rows plus the row being typed. Solved boards
    // stop growing; boards missed at the end show their answer.
    for (let b = 0; b < NUM_BOARDS; b++) {
      const { el, rows, answer } = this.boards[b];
      const history = this.game.boardHistory(b);
      const solved = this.game.solved(b);
      const typing = !solved && !over;
      el.classList.toggle("solved", solved);
      el.classList.toggle("failed", over && !solved);
      for (let r = 0; r < MAX_GUESSES; r++) {
        const row = rows[r];
        row.el.hidden = r >= history.length + (typing ? 1 : 0);
        if (row.el.hidden) continue;
        for (let col = 0; col < WORD_LENGTH; col++) {
          const tile = row.tiles[col];
          if (r < history.length) {
            const [word, score] = history[r];
            tile.className = "tile " + SCORE_CLASS[score[col]];
            tile.textContent = word[col];
          } else if (col < this.current.length) {
            tile.className = "tile typed";
            tile.textContent = this.current[col];
          } else {
            tile.className = "tile";
            tile.textContent = "";
          }
        }
      }
      answer.el.hidden = !(over && !solved);
      answer.tiles.forEach((tile, col) => {
        tile.className = "tile miss";
        tile.textContent = this.game.targets[b][col];
      });
    }

    // Status line and message
    const left = MAX_GUESSES - this.game.guesses.length;
    this.statusEl.textContent =
      "Solved " + this.solvedCount() + "/" + NUM_BOARDS + " · " +
      left + (left === 1 ? " guess" : " guesses") + " left";
    this.messageEl.textContent = this.message;

    // Keyboard: darken letters that are ruled out on every unsolved board.
    const dead = this.deadLetters();
    for (const [label, key] of Object.entries(this.keys)) {
      key.classList.toggle("dead", dead.has(label.toLowerCase()));
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

function showError(text) {
  const el = document.getElementById("message");
  if (el) el.textContent = text;
}

loadWords()
  .then((words) => {
    WORDS = words;
    WORD_SET = new Set(words);
    try {
      new MultiApp();
    } catch (err) {
      showError("Could not start the game (" + err.message + "). Try reloading the page.");
      throw err;
    }
  }, (err) => {
    showError("Could not load words.txt (" + err.message + ")");
  });
