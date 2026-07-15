<template>
  <main class="snake-game" @click="focusBoard">
    <section class="game-shell" aria-labelledby="game-title">
      <nav class="game-nav" aria-label="游戏切换">
        <RouterLink to="/">贪吃蛇</RouterLink>
        <RouterLink to="/2048">2048</RouterLink>
        <RouterLink to="/tetris">俄罗斯方块</RouterLink>
        <RouterLink to="/gomoku">五子棋</RouterLink>
      </nav>

      <div class="game-header">
        <div>
          <p class="eyebrow">Keyboard Snake</p>
          <h1 id="game-title">贪吃蛇</h1>
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
          class="board"
          tabindex="0"
          role="application"
          aria-label="贪吃蛇游戏区域"
          @keydown.stop="handleKey"
        >
          <div
            v-for="cell in cells"
            :key="cell.key"
            :class="['cell', cell.type]"
            :style="{ '--x': cell.x, '--y': cell.y }"
          >
            <span v-if="cell.type === 'head'" class="eye eye-left"></span>
            <span v-if="cell.type === 'head'" class="eye eye-right"></span>
          </div>
          <div v-if="!running" class="overlay">
            <strong>{{ overlayTitle }}</strong>
            <span>{{ overlayText }}</span>
          </div>
        </div>

        <aside class="side-panel" aria-label="游戏控制">
          <div class="status">
            <span>状态</span>
            <strong>{{ statusLabel }}</strong>
          </div>

          <div class="controls">
            <button type="button" @click="startGame">
              {{ gameOver ? "重新开始" : started ? "继续" : "开始" }}
            </button>
            <button type="button" :disabled="!started || gameOver" @click="togglePause">
              {{ paused ? "继续" : "暂停" }}
            </button>
          </div>

          <dl class="keys">
            <div>
              <dt>移动</dt>
              <dd>方向键 / WASD / 滑动</dd>
            </div>
            <div>
              <dt>暂停</dt>
              <dd>Space</dd>
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

type Point = {
  x: number;
  y: number;
};

type Direction = "up" | "down" | "left" | "right";
type CellType = "empty" | "snake" | "head" | "food";

const BOARD_SIZE = 20;
const START_SNAKE: Point[] = [
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 },
];
const START_DIRECTION: Direction = "right";
const TICK_MS = 120;
const BEST_SCORE_KEY = "snake-best-score";

const boardRef = ref<HTMLElement | null>(null);
const snake = ref<Point[]>(cloneSnake(START_SNAKE));
const food = ref<Point>({ x: 14, y: 10 });
const direction = ref<Direction>(START_DIRECTION);
const nextDirection = ref<Direction>(START_DIRECTION);
const score = ref(0);
const bestScore = ref(0);
const started = ref(false);
const paused = ref(false);
const gameOver = ref(false);

let timer: number | undefined;
let touchStartX = 0;
let touchStartY = 0;

const running = computed(() => started.value && !paused.value && !gameOver.value);

const statusLabel = computed(() => {
  if (gameOver.value) return "已结束";
  if (!started.value) return "待开始";
  if (paused.value) return "已暂停";
  return "进行中";
});

const overlayTitle = computed(() => {
  if (gameOver.value) return "游戏结束";
  if (paused.value) return "已暂停";
  return "准备开始";
});

const overlayText = computed(() => {
  if (gameOver.value) return "按 R 或点击重新开始";
  if (paused.value) return "按 Space 继续";
  return "按方向键、WASD 或滑动开始";
});

const snakeMap = computed(() => {
  const map = new Map<string, CellType>();
  snake.value.forEach((part, index) => {
    map.set(toKey(part), index === 0 ? "head" : "snake");
  });
  map.set(toKey(food.value), "food");
  return map;
});

const cells = computed(() => {
  const nextCells: Array<Point & { key: string; type: CellType }> = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const key = `${x}-${y}`;
      nextCells.push({
        x,
        y,
        key,
        type: snakeMap.value.get(key) ?? "empty",
      });
    }
  }

  return nextCells;
});

function cloneSnake(value: Point[]) {
  return value.map((point) => ({ ...point }));
}

function toKey(point: Point) {
  return `${point.x}-${point.y}`;
}

function isSamePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function startGame() {
  if (gameOver.value || !started.value) {
    resetGame();
  }

  started.value = true;
  paused.value = false;
  focusBoard();
  startTimer();
}

function resetGame() {
  snake.value = cloneSnake(START_SNAKE);
  direction.value = START_DIRECTION;
  nextDirection.value = START_DIRECTION;
  score.value = 0;
  gameOver.value = false;
  paused.value = false;
  food.value = createFood(snake.value);
}

function togglePause() {
  if (!started.value || gameOver.value) return;

  paused.value = !paused.value;
  if (paused.value) {
    stopTimer();
  } else {
    focusBoard();
    startTimer();
  }
}

function startTimer() {
  stopTimer();
  timer = window.setInterval(moveSnake, TICK_MS);
}

function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

function moveSnake() {
  if (!running.value) return;

  direction.value = nextDirection.value;

  const head = snake.value[0];
  const nextHead = getNextHead(head, direction.value);
  const ateFood = isSamePoint(nextHead, food.value);
  const bodyToCheck = ateFood ? snake.value : snake.value.slice(0, -1);

  if (isWallHit(nextHead) || bodyToCheck.some((part) => isSamePoint(part, nextHead))) {
    endGame();
    return;
  }

  snake.value = [nextHead, ...snake.value];

  if (ateFood) {
    score.value += 10;
    bestScore.value = Math.max(bestScore.value, score.value);
    saveBestScore();
    food.value = createFood(snake.value);
  } else {
    snake.value.pop();
  }
}

function getNextHead(head: Point, next: Direction): Point {
  const movement: Record<Direction, Point> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  return {
    x: head.x + movement[next].x,
    y: head.y + movement[next].y,
  };
}

function isWallHit(point: Point) {
  return point.x < 0 || point.x >= BOARD_SIZE || point.y < 0 || point.y >= BOARD_SIZE;
}

function createFood(currentSnake: Point[]) {
  const occupied = new Set(currentSnake.map(toKey));
  const available: Point[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!occupied.has(`${x}-${y}`)) {
        available.push({ x, y });
      }
    }
  }

  return available[Math.floor(Math.random() * available.length)] ?? { x: 0, y: 0 };
}

function setDirection(next: Direction) {
  const opposites: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  if (opposites[next] !== direction.value) {
    nextDirection.value = next;
  }
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
    if (!started.value || gameOver.value) startGame();
    setDirection(keyMap[event.key]);
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    if (!started.value || gameOver.value) {
      startGame();
    } else {
      togglePause();
    }
    return;
  }

  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    resetGame();
    started.value = true;
    startTimer();
  }
}

function handleWindowKey(event: KeyboardEvent) {
  handleKey(event);
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
      setDirection("right");
    } else {
      setDirection("left");
    }
  } else {
    if (diffY > 0) {
      setDirection("down");
    } else {
      setDirection("up");
    }
  }

  if (!started.value || gameOver.value) {
    startGame();
  }

  touchStartX = 0;
  touchStartY = 0;
}

function focusBoard() {
  nextTick(() => boardRef.value?.focus());
}

function endGame() {
  gameOver.value = true;
  paused.value = false;
  stopTimer();
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
  resetGame();
  window.addEventListener("keydown", handleWindowKey);
  boardRef.value?.addEventListener("touchstart", handleTouchStart, { passive: true });
  boardRef.value?.addEventListener("touchend", handleTouchEnd, { passive: true });
  focusBoard();
});

onUnmounted(() => {
  stopTimer();
  window.removeEventListener("keydown", handleWindowKey);
  boardRef.value?.removeEventListener("touchstart", handleTouchStart);
  boardRef.value?.removeEventListener("touchend", handleTouchEnd);
});
</script>

<style scoped>
.snake-game {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 32px;
  box-sizing: border-box;
  background:
    linear-gradient(135deg, rgba(28, 44, 36, 0.88), rgba(15, 21, 25, 0.96)),
    radial-gradient(circle at top left, rgba(255, 210, 112, 0.22), transparent 34%);
}

.game-shell {
  width: min(100%, 900px);
  color: #f4f7ef;
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
  color: #102019;
  background: #ffc95a;
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
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffc95a;
}

h1 {
  margin: 0;
  font-size: 44px;
  line-height: 1;
  letter-spacing: 0;
  color: #ffffff;
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
  box-sizing: border-box;
}

.scoreboard span,
.status span {
  display: block;
  margin-bottom: 3px;
  color: #abb7ae;
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
  grid-template-columns: minmax(280px, 560px) 220px;
  gap: 22px;
  align-items: start;
}

.board {
  --cell-size: clamp(14px, 2.8vw, 26px);
  position: relative;
  display: grid;
  grid-template-columns: repeat(20, var(--cell-size));
  grid-template-rows: repeat(20, var(--cell-size));
  width: calc(var(--cell-size) * 20);
  height: calc(var(--cell-size) * 20);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: #102019;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
  outline: none;
}

.board:focus-visible {
  border-color: #ffc95a;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.32),
    0 0 0 3px rgba(255, 201, 90, 0.28);
}

.cell {
  position: relative;
  width: var(--cell-size);
  height: var(--cell-size);
  background: rgba(255, 255, 255, 0.025);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.035);
}

.cell.snake,
.cell.head {
  background: linear-gradient(135deg, #78d36a, #2da75f);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    inset 0 -3px 0 rgba(0, 0, 0, 0.15);
}

.cell.head {
  background: linear-gradient(135deg, #d7f76b, #3ecf6d);
}

.cell.food::after {
  content: "";
  position: absolute;
  inset: 20%;
  border-radius: 50%;
  background: #ff5c62;
  box-shadow:
    inset -3px -4px 0 rgba(117, 0, 12, 0.2),
    0 0 14px rgba(255, 92, 98, 0.55);
}

.eye {
  position: absolute;
  top: 28%;
  width: 14%;
  height: 14%;
  border-radius: 50%;
  background: #102019;
}

.eye-left {
  left: 30%;
}

.eye-right {
  right: 30%;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  background: rgba(8, 11, 13, 0.68);
  text-align: center;
}

.overlay strong {
  font-size: 28px;
  color: #ffffff;
}

.overlay span {
  color: #d7ded8;
}

.side-panel {
  display: grid;
  gap: 14px;
}

.controls {
  display: grid;
  gap: 10px;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 7px;
  padding: 0 16px;
  color: #102019;
  background: #ffc95a;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #ffda85;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
  color: #abb7ae;
  font-size: 13px;
}

.keys dd {
  margin: 2px 0 0;
  color: #ffffff;
  font-weight: 700;
}

@media (max-width: 768px) {
  .snake-game {
    padding: 22px 14px;
  }

  .game-header,
  .game-layout {
    grid-template-columns: 1fr;
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
    justify-items: center;
  }

  .side-panel {
    width: min(100%, 520px);
  }
}
</style>
