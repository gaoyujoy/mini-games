<template>
  <main class="gomoku" @click="focusBoard">
    <section class="game-shell" aria-labelledby="game-title">
      <nav class="game-nav" aria-label="游戏切换">
        <RouterLink to="/">贪吃蛇</RouterLink>
        <RouterLink to="/2048">2048</RouterLink>
        <RouterLink to="/tetris">俄罗斯方块</RouterLink>
        <RouterLink to="/gomoku">五子棋</RouterLink>
      </nav>

      <div class="game-header">
        <div>
          <p class="eyebrow">Board Game</p>
          <h1 id="game-title">五子棋</h1>
        </div>
      </div>

      <div class="game-layout">
        <div
          ref="boardRef"
          class="board"
          tabindex="0"
          role="application"
          aria-label="五子棋游戏区域"
        >
          <div class="board-bg">
            <div v-for="r in BOARD_SIZE" :key="'row-' + r" class="board-row">
              <div
                v-for="c in BOARD_SIZE"
                :key="'cell-' + r + '-' + c"
                class="cell"
                :class="cellClass(r - 1, c - 1)"
                @click="place(r - 1, c - 1)"
              />
            </div>
          </div>
          <div
            v-for="stone in stones"
            :key="stone.key"
            class="stone"
            :class="stone.color"
            :style="{ '--x': stone.x, '--y': stone.y }"
          />
          <div v-if="winner || isDraw" class="overlay">
            <strong>{{ overlayTitle }}</strong>
            <span>{{ overlayText }}</span>
          </div>
        </div>

        <aside class="side-panel" aria-label="游戏控制">
          <div class="status">
            <span>状态</span>
            <strong>{{ statusLabel }}</strong>
          </div>

          <button type="button" @click="newGame">重新开始</button>

          <dl class="keys">
            <div>
              <dt>当前回合</dt>
              <dd>{{ currentPlayer === 'black' ? '⚫ 黑棋' : '⚪ 白棋' }}</dd>
            </div>
            <div>
              <dt>操作</dt>
              <dd>点击格子落子</dd>
            </div>
            <div>
              <dt>方式</dt>
              <dd>两人轮流</dd>
            </div>
            <div>
              <dt>重开</dt>
              <dd>R</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, nextTick, ref } from "vue";
import { RouterLink } from "vue-router";

const BOARD_SIZE = 15;
const WIN_COUNT = 5;

const boardRef = ref<HTMLElement | null>(null);
const grid = ref<Array<Array<string | null>>>(createEmptyGrid());
const currentPlayer = ref<"black" | "white">("black");
const winner = ref<string | null>(null);
const moveCount = ref(0);

type Stone = {
  key: string;
  x: number;
  y: number;
  color: string;
};

const stones = computed<Stone[]>(() => {
  const result: Stone[] = [];
  grid.value.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        result.push({ key: `${x}-${y}`, x, y, color: cell });
      }
    });
  });
  return result;
});

const isDraw = computed(() => !winner.value && moveCount.value === BOARD_SIZE * BOARD_SIZE);

const statusLabel = computed(() => {
  if (winner.value) return winner.value === "black" ? "黑棋胜" : "白棋胜";
  if (isDraw.value) return "平局";
  return "进行中";
});

const overlayTitle = computed(() => {
  if (winner.value) return winner.value === "black" ? "黑棋获胜" : "白棋获胜";
  return "平局";
});

const overlayText = computed(() => "按 R 重新开始");

function createEmptyGrid() {
  return Array.from({ length: BOARD_SIZE }, () => Array<string | null>(BOARD_SIZE).fill(null));
}

function newGame() {
  grid.value = createEmptyGrid();
  currentPlayer.value = "black";
  winner.value = null;
  moveCount.value = 0;
  focusBoard();
}

function isStarPoint(r: number, c: number) {
  const stars = [3, 7, 11];
  return stars.includes(r) && stars.includes(c);
}

function cellClass(r: number, c: number) {
  return {
    "star-point": isStarPoint(r, c),
    "first-row": r === 0,
    "last-row": r === BOARD_SIZE - 1,
    "first-col": c === 0,
    "last-col": c === BOARD_SIZE - 1,
  };
}

function place(r: number, c: number) {
  if (winner.value || isDraw.value) return;
  if (grid.value[r][c]) return;

  const nextGrid = grid.value.map((row) => [...row]);
  nextGrid[r][c] = currentPlayer.value;
  grid.value = nextGrid;
  moveCount.value++;

  if (checkWin(r, c, currentPlayer.value)) {
    winner.value = currentPlayer.value;
  } else {
    currentPlayer.value = currentPlayer.value === "black" ? "white" : "black";
  }
}

function checkWin(r: number, c: number, player: string) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    count += countDir(r, c, dr, dc, player);
    count += countDir(r, c, -dr, -dc, player);
    if (count >= WIN_COUNT) return true;
  }

  return false;
}

function countDir(r: number, c: number, dr: number, dc: number, player: string) {
  let count = 0;
  let nr = r + dr;
  let nc = c + dc;

  while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && grid.value[nr][nc] === player) {
    count++;
    nr += dr;
    nc += dc;
  }

  return count;
}

function handleKey(event: KeyboardEvent) {
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    newGame();
  }
}

function focusBoard() {
  nextTick(() => boardRef.value?.focus());
}

onMounted(() => {
  newGame();
  window.addEventListener("keydown", handleKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKey);
});
</script>

<style scoped>
.gomoku {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 32px;
  background:
    linear-gradient(135deg, rgba(50, 43, 34, 0.92), rgba(18, 20, 24, 0.96)),
    radial-gradient(circle at top left, rgba(255, 196, 87, 0.2), transparent 34%);
}

.game-shell {
  width: min(100%, 860px);
}

.game-nav {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 18px;
  padding: 5px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 11, 13, 0.42);
}

.game-nav a {
  min-width: 78px;
  padding: 7px 12px;
  border-radius: 6px;
  color: #f4f7ef;
  text-align: center;
  text-decoration: none;
  font-weight: 800;
}

.game-nav a.router-link-active {
  color: #1d1710;
  background: #ffd46d;
}

.game-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffd46d;
}

h1 {
  margin: 0;
  color: #ffffff;
  font-size: 56px;
  line-height: 1;
  letter-spacing: 0;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(280px, 520px) 220px;
  gap: 22px;
  align-items: start;
}

.board {
  --board-size: min(62vw, 480px);
  --cell-size: calc(var(--board-size) / 15);
  position: relative;
  width: var(--board-size);
  height: var(--board-size);
  border-radius: 8px;
  background: #d4a853;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
  outline: none;
}

.board:focus-visible {
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.34),
    0 0 0 3px rgba(255, 212, 109, 0.32);
}

.board-bg {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: repeat(15, 1fr);
}

.board-row {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
}

.cell {
  position: relative;
  cursor: pointer;
}

/* Horizontal line: full width, centered vertically */
.cell::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  background: #6d4c1a;
  transform: translateY(-50%);
}

/* First column: only right half */
.cell.first-col::before {
  left: 50%;
  width: 50%;
}

/* Last column: only left half */
.cell.last-col::before {
  width: 50%;
}

/* Vertical line: full height, centered horizontally */
.cell::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  height: 100%;
  width: 1px;
  background: #6d4c1a;
  transform: translateX(-50%);
}

/* First row: only bottom half */
.cell.first-row::after {
  top: 50%;
  height: 50%;
}

/* Last row: only top half */
.cell.last-row::after {
  height: 50%;
}

/* Star point dot */
.cell.star-point {
  background: radial-gradient(circle at 50% 50%, #6d4c1a 3.5px, transparent 4px);
}

.stone {
  --stone-size: calc(var(--cell-size) * 0.82);
  position: absolute;
  width: var(--stone-size);
  height: var(--stone-size);
  border-radius: 50%;
  left: calc(var(--x) * var(--cell-size) + (var(--cell-size) - var(--stone-size)) / 2);
  top: calc(var(--y) * var(--cell-size) + (var(--cell-size) - var(--stone-size)) / 2);
  pointer-events: none;
  z-index: 2;
}

.stone.black {
  background: radial-gradient(circle at 36% 36%, #555, #111);
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
}

.stone.white {
  background: radial-gradient(circle at 36% 36%, #fff, #ccc);
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-content: center;
  gap: 8px;
  border-radius: 8px;
  background: rgba(49, 43, 34, 0.72);
  text-align: center;
}

.overlay strong {
  color: #ffffff;
  font-size: 30px;
}

.overlay span {
  color: #fff2d2;
}

.side-panel {
  display: grid;
  gap: 14px;
}

.status {
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 11, 13, 0.48);
}

.status span {
  display: block;
  margin-bottom: 3px;
  color: #d9d1c4;
  font-size: 13px;
}

.status strong {
  color: #ffffff;
  font-size: 24px;
  line-height: 1;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 7px;
  padding: 0 16px;
  color: #1d1710;
  background: #ffd46d;
  font-weight: 900;
  cursor: pointer;
}

button:hover {
  background: #ffe19a;
}

.keys {
  margin: 0;
  display: grid;
  gap: 10px;
}

.keys div {
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
}

.keys dt {
  color: #d9d1c4;
  font-size: 13px;
}

.keys dd {
  margin: 2px 0 0;
  color: #ffffff;
  font-weight: 800;
}

@media (max-width: 768px) {
  .gomoku {
    padding: 22px 14px;
  }

  .game-header {
    display: grid;
    gap: 16px;
  }

  .game-layout {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .board {
    --board-size: min(85vw, 480px);
  }

  .side-panel {
    width: min(100%, 520px);
  }
}
</style>
