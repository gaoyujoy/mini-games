<template>
  <main class="game-2048" @click="focusBoard">
    <section class="game-shell" aria-labelledby="game-title">
      <nav class="game-nav" aria-label="游戏切换">
        <RouterLink to="/">贪吃蛇</RouterLink>
        <RouterLink to="/2048">2048</RouterLink>
        <RouterLink to="/tetris">俄罗斯方块</RouterLink>
        <RouterLink to="/gomoku">五子棋</RouterLink>
      </nav>

      <div class="game-header">
        <div>
          <p class="eyebrow">Keyboard Puzzle</p>
          <h1 id="game-title">2048</h1>
        </div>
        <div class="scoreboard" aria-label="分数面板">
          <div>
            <span>分数</span>
            <strong>{{ score }}</strong>
          </div>
          <div>
            <span>最高</span>
            <strong>{{ bestScore }}</strong>
          </div>
        </div>
      </div>

      <div class="game-layout">
        <div
          ref="boardRef"
          class="board-2048"
          tabindex="0"
          role="application"
          aria-label="2048 游戏区域"
          @keydown.stop="handleKey"
        >
          <div v-for="index in 16" :key="index" class="grid-cell"></div>
          <div
            v-for="tile in tiles"
            :key="tile.key"
            class="tile"
            :class="`tile-${tile.value}`"
            :style="{ '--x': tile.x, '--y': tile.y }"
          >
            {{ tile.value }}
          </div>

          <div v-if="won || gameOver" class="overlay">
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
              <dt>移动</dt>
              <dd>方向键 / WASD / 滑动</dd>
            </div>
            <div>
              <dt>目标</dt>
              <dd>合成 2048</dd>
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
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";

type Direction = "up" | "down" | "left" | "right";
type Tile = {
  value: number;
  x: number;
  y: number;
};

type RenderTile = Tile & {
  key: string;
};

const SIZE = 4;
const BEST_SCORE_KEY = "2048-best-score";

const boardRef = ref<HTMLElement | null>(null);
const board = ref<number[][]>(createEmptyBoard());
const score = ref(0);
const bestScore = ref(0);
const won = ref(false);
const gameOver = ref(false);

let touchStartX = 0;
let touchStartY = 0;

const tiles = computed<RenderTile[]>(() => {
  const nextTiles: RenderTile[] = [];

  board.value.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        nextTiles.push({
          key: `${x}-${y}-${value}`,
          value,
          x,
          y,
        });
      }
    });
  });

  return nextTiles;
});

const statusLabel = computed(() => {
  if (won.value) return "已达成";
  if (gameOver.value) return "无可移动";
  return "进行中";
});

const overlayTitle = computed(() => (won.value ? "你赢了" : "游戏结束"));
const overlayText = computed(() => (won.value ? "按 R 开始新局" : "按 R 重新开始"));

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

function newGame() {
  board.value = createEmptyBoard();
  score.value = 0;
  won.value = false;
  gameOver.value = false;
  addRandomTile();
  addRandomTile();
  focusBoard();
}

function addRandomTile() {
  const emptyCells: Array<{ x: number; y: number }> = [];

  board.value.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value === 0) emptyCells.push({ x, y });
    });
  });

  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  if (!cell) return;

  const nextBoard = cloneBoard(board.value);
  nextBoard[cell.y][cell.x] = Math.random() < 0.9 ? 2 : 4;
  board.value = nextBoard;
}

function cloneBoard(value: number[][]) {
  return value.map((row) => [...row]);
}

function move(direction: Direction) {
  if (won.value || gameOver.value) return;

  const { nextBoard, gainedScore, moved } = slideBoard(board.value, direction);
  if (!moved) return;

  board.value = nextBoard;
  score.value += gainedScore;
  bestScore.value = Math.max(bestScore.value, score.value);
  saveBestScore();

  addRandomTile();

  if (board.value.some((row) => row.includes(2048))) {
    won.value = true;
  } else if (!canMove(board.value)) {
    gameOver.value = true;
  }
}

function slideBoard(currentBoard: number[][], direction: Direction) {
  const nextBoard = createEmptyBoard();
  let gainedScore = 0;

  for (let index = 0; index < SIZE; index++) {
    const line = getLine(currentBoard, direction, index);
    const merged = mergeLine(line);
    gainedScore += merged.score;
    setLine(nextBoard, direction, index, merged.values);
  }

  return {
    nextBoard,
    gainedScore,
    moved: JSON.stringify(currentBoard) !== JSON.stringify(nextBoard),
  };
}

function getLine(currentBoard: number[][], direction: Direction, index: number) {
  if (direction === "left") return currentBoard[index];
  if (direction === "right") return [...currentBoard[index]].reverse();
  if (direction === "up") return currentBoard.map((row) => row[index]);
  return currentBoard.map((row) => row[index]).reverse();
}

function setLine(targetBoard: number[][], direction: Direction, index: number, values: number[]) {
  const line = direction === "right" || direction === "down" ? [...values].reverse() : values;

  for (let offset = 0; offset < SIZE; offset++) {
    if (direction === "left" || direction === "right") {
      targetBoard[index][offset] = line[offset];
    } else {
      targetBoard[offset][index] = line[offset];
    }
  }
}

function mergeLine(line: number[]) {
  const compacted = line.filter(Boolean);
  const values: number[] = [];
  let scoreFromLine = 0;

  for (let index = 0; index < compacted.length; index++) {
    if (compacted[index] === compacted[index + 1]) {
      const mergedValue = compacted[index] * 2;
      values.push(mergedValue);
      scoreFromLine += mergedValue;
      index++;
    } else {
      values.push(compacted[index]);
    }
  }

  while (values.length < SIZE) {
    values.push(0);
  }

  return { values, score: scoreFromLine };
}

function canMove(currentBoard: number[][]) {
  if (currentBoard.some((row) => row.includes(0))) return true;

  return currentBoard.some((row, y) =>
    row.some((value, x) => {
      const right = currentBoard[y][x + 1];
      const down = currentBoard[y + 1]?.[x];
      return value === right || value === down;
    }),
  );
}

function handleKey(event: KeyboardEvent) {
  const keyMap: Record<string, Direction> = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (event.key in keyMap) {
    event.preventDefault();
    move(keyMap[event.key]);
  }

  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    newGame();
  }
}

function handleTouchStart(event: TouchEvent) {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}

function handleTouchEnd(event: TouchEvent) {
  if (!touchStartX || !touchStartY) return;

  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;

  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  const minSwipeDistance = 30;

  if (Math.abs(diffX) < minSwipeDistance && Math.abs(diffY) < minSwipeDistance) {
    return;
  }

  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 0) {
      move("right");
    } else {
      move("left");
    }
  } else {
    if (diffY > 0) {
      move("down");
    } else {
      move("up");
    }
  }

  touchStartX = 0;
  touchStartY = 0;
}

function focusBoard() {
  nextTick(() => boardRef.value?.focus());
}

function loadBestScore() {
  const saved = Number(window.localStorage.getItem(BEST_SCORE_KEY));
  bestScore.value = Number.isFinite(saved) ? saved : 0;
}

function saveBestScore() {
  window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore.value));
}

onMounted(() => {
  loadBestScore();
  newGame();
  window.addEventListener("keydown", handleKey);
  boardRef.value?.addEventListener("touchstart", handleTouchStart, { passive: true });
  boardRef.value?.addEventListener("touchend", handleTouchEnd, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKey);
  boardRef.value?.removeEventListener("touchstart", handleTouchStart);
  boardRef.value?.removeEventListener("touchend", handleTouchEnd);
});
</script>

<style scoped>
.game-2048 {
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

.scoreboard {
  display: flex;
  gap: 10px;
}

.scoreboard div,
.status {
  min-width: 96px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 11, 13, 0.48);
}

.scoreboard span,
.status span {
  display: block;
  margin-bottom: 3px;
  color: #d9d1c4;
  font-size: 13px;
}

.scoreboard strong,
.status strong {
  color: #ffffff;
  font-size: 24px;
  line-height: 1;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(280px, 520px) 220px;
  gap: 22px;
  align-items: start;
}

.board-2048 {
  --tile-gap: clamp(8px, 1.8vw, 14px);
  --tile-size: clamp(58px, 16vw, 118px);
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, var(--tile-size));
  grid-template-rows: repeat(4, var(--tile-size));
  gap: var(--tile-gap);
  width: calc(var(--tile-size) * 4 + var(--tile-gap) * 5);
  height: calc(var(--tile-size) * 4 + var(--tile-gap) * 5);
  padding: var(--tile-gap);
  border-radius: 8px;
  background: #8f7f69;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
  outline: none;
}

.board-2048:focus-visible {
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.34),
    0 0 0 3px rgba(255, 212, 109, 0.32);
}

.grid-cell,
.tile {
  width: var(--tile-size);
  height: var(--tile-size);
  border-radius: 7px;
}

.grid-cell {
  background: rgba(255, 255, 255, 0.17);
}

.tile {
  position: absolute;
  left: calc(var(--tile-gap) + var(--x) * (var(--tile-size) + var(--tile-gap)));
  top: calc(var(--tile-gap) + var(--y) * (var(--tile-size) + var(--tile-gap)));
  display: grid;
  place-items: center;
  color: #6d604f;
  background: #eee4da;
  font-size: clamp(24px, 6vw, 48px);
  font-weight: 900;
  line-height: 1;
  transition:
    left 120ms ease,
    top 120ms ease,
    transform 120ms ease;
}

.tile-8,
.tile-16,
.tile-32,
.tile-64,
.tile-128,
.tile-256,
.tile-512,
.tile-1024,
.tile-2048 {
  color: #fff9ef;
}

.tile-2 {
  background: #eee4da;
}

.tile-4 {
  background: #ede0c8;
}

.tile-8 {
  background: #f2b179;
}

.tile-16 {
  background: #f59563;
}

.tile-32 {
  background: #f67c5f;
}

.tile-64 {
  background: #f65e3b;
}

.tile-128 {
  background: #edcf72;
  font-size: clamp(20px, 5.2vw, 40px);
}

.tile-256 {
  background: #edcc61;
  font-size: clamp(20px, 5.2vw, 40px);
}

.tile-512 {
  background: #edc850;
  font-size: clamp(20px, 5.2vw, 40px);
}

.tile-1024 {
  background: #edc53f;
  font-size: clamp(18px, 4.5vw, 34px);
}

.tile-2048 {
  background: #edc22e;
  font-size: clamp(18px, 4.5vw, 34px);
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
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
  .game-2048 {
    padding: 22px 14px;
  }

  .game-header {
    display: grid;
    gap: 16px;
  }

  .scoreboard {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .game-layout {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .side-panel {
    width: min(100%, 520px);
  }
}
</style>
