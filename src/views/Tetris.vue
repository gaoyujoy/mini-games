<template>
  <main class="tetris-game" @click="focusBoard">
    <section class="game-shell" aria-labelledby="game-title">
      <nav class="game-nav" aria-label="游戏切换">
        <RouterLink to="/">贪吃蛇</RouterLink>
        <RouterLink to="/2048">2048</RouterLink>
        <RouterLink to="/tetris">俄罗斯方块</RouterLink>
        <RouterLink to="/gomoku">五子棋</RouterLink>
      </nav>

      <div class="game-header">
        <div>
          <p class="eyebrow">Keyboard Blocks</p>
          <h1 id="game-title">俄罗斯方块</h1>
        </div>
        <div class="scoreboard" aria-label="分数面板">
          <div>
            <span>分数</span>
            <strong>{{ score }}</strong>
          </div>
          <div>
            <span>行数</span>
            <strong>{{ lines }}</strong>
          </div>
        </div>
      </div>

      <div class="game-layout">
        <div
          ref="boardRef"
          class="tetris-board"
          tabindex="0"
          role="application"
          aria-label="俄罗斯方块游戏区域"
          @keydown.stop="handleKey"
        >
          <div
            v-for="cell in cells"
            :key="cell.key"
            :class="['cell', cell.kind && `piece-${cell.kind}`]"
          ></div>
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

          <div class="next-piece">
            <span>下一个</span>
            <div class="mini-board" aria-hidden="true">
              <div
                v-for="cell in previewCells"
                :key="cell.key"
                :class="['mini-cell', cell.kind && `piece-${cell.kind}`]"
              ></div>
            </div>
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
              <dd>← → / A D / 滑动</dd>
            </div>
            <div>
              <dt>旋转</dt>
              <dd>↑ / W / 上滑</dd>
            </div>
            <div>
              <dt>下落</dt>
              <dd>↓ 软降 / 点击硬降</dd>
            </div>
            <div>
              <dt>暂停/重开</dt>
              <dd>P / R</dd>
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

type PieceKind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Point = { x: number; y: number };
type Piece = {
  kind: PieceKind;
  shape: Point[];
  position: Point;
};
type Cell = {
  key: string;
  kind: PieceKind | "";
};

const ROWS = 20;
const COLS = 10;
const TICK_MS = 520;

const SHAPES: Record<PieceKind, Point[]> = {
  I: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],
  O: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  T: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ],
  S: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
  ],
  Z: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  J: [
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  L: [
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
};

const PIECES = Object.keys(SHAPES) as PieceKind[];

const boardRef = ref<HTMLElement | null>(null);
const board = ref(createEmptyBoard());
const currentPiece = ref<Piece | null>(null);
const nextKind = ref(randomKind());
const score = ref(0);
const lines = ref(0);
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
  if (paused.value) return "按 P 继续";
  return "按开始或方向键进入游戏";
});

const cells = computed<Cell[]>(() => {
  const merged = board.value.map((row) => [...row]);

  if (currentPiece.value) {
    getAbsolutePoints(currentPiece.value).forEach((point) => {
      if (point.y >= 0 && point.y < ROWS && point.x >= 0 && point.x < COLS) {
        merged[point.y][point.x] = currentPiece.value?.kind ?? "";
      }
    });
  }

  return merged.flatMap((row, y) =>
    row.map((kind, x) => ({
      key: `${x}-${y}`,
      kind,
    })),
  );
});

const previewCells = computed<Cell[]>(() => {
  const preview = Array.from({ length: 16 }, (_, index) => ({
    key: String(index),
    kind: "" as PieceKind | "",
  }));
  const shape = SHAPES[nextKind.value];
  const offsetX = nextKind.value === "I" ? 1 : 2;
  const offsetY = nextKind.value === "I" ? 2 : 1;

  shape.forEach((point) => {
    const x = point.x + offsetX;
    const y = point.y + offsetY;
    if (x >= 0 && x < 4 && y >= 0 && y < 4) {
      preview[y * 4 + x].kind = nextKind.value;
    }
  });

  return preview;
});

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array<PieceKind | "">(COLS).fill(""));
}

function randomKind() {
  return PIECES[Math.floor(Math.random() * PIECES.length)];
}

function createPiece(kind: PieceKind): Piece {
  return {
    kind,
    shape: SHAPES[kind].map((point) => ({ ...point })),
    position: { x: Math.floor(COLS / 2), y: 0 },
  };
}

function startGame() {
  if (!started.value || gameOver.value) {
    resetGame();
  }

  started.value = true;
  paused.value = false;
  focusBoard();
  startTimer();
}

function resetGame() {
  board.value = createEmptyBoard();
  score.value = 0;
  lines.value = 0;
  gameOver.value = false;
  paused.value = false;
  nextKind.value = randomKind();
  spawnPiece();
}

function spawnPiece() {
  const piece = createPiece(nextKind.value);
  nextKind.value = randomKind();

  if (!canPlace(piece)) {
    currentPiece.value = piece;
    endGame();
    return;
  }

  currentPiece.value = piece;
}

function tick() {
  if (!running.value || !currentPiece.value) return;

  if (!movePiece(0, 1)) {
    lockPiece();
  }
}

function movePiece(dx: number, dy: number) {
  if (!currentPiece.value) return false;

  const moved = {
    ...currentPiece.value,
    position: {
      x: currentPiece.value.position.x + dx,
      y: currentPiece.value.position.y + dy,
    },
  };

  if (!canPlace(moved)) return false;

  currentPiece.value = moved;
  return true;
}

function rotatePiece() {
  if (!currentPiece.value || currentPiece.value.kind === "O") return;

  const rotated = {
    ...currentPiece.value,
    shape: currentPiece.value.shape.map((point) => ({ x: -point.y, y: point.x })),
  };

  const kicks = [0, -1, 1, -2, 2];
  const kicked = kicks
    .map((dx) => ({
      ...rotated,
      position: { x: rotated.position.x + dx, y: rotated.position.y },
    }))
    .find(canPlace);

  if (kicked) {
    currentPiece.value = kicked;
  }
}

function hardDrop() {
  if (!currentPiece.value) return;

  let distance = 0;
  while (movePiece(0, 1)) {
    distance++;
  }

  score.value += distance * 2;
  lockPiece();
}

function lockPiece() {
  if (!currentPiece.value) return;

  const piece = currentPiece.value;
  const nextBoard = board.value.map((row) => [...row]);
  getAbsolutePoints(piece).forEach((point) => {
    if (point.y >= 0 && point.y < ROWS && point.x >= 0 && point.x < COLS) {
      nextBoard[point.y][point.x] = piece.kind;
    }
  });

  board.value = nextBoard;
  clearLines();
  spawnPiece();
}

function clearLines() {
  const remainingRows = board.value.filter((row) => row.some((cell) => cell === ""));
  const cleared = ROWS - remainingRows.length;

  if (cleared === 0) return;

  const newRows = Array.from({ length: cleared }, () => Array<PieceKind | "">(COLS).fill(""));
  board.value = [...newRows, ...remainingRows];
  lines.value += cleared;
  score.value += [0, 100, 300, 500, 800][cleared] ?? cleared * 200;
}

function canPlace(piece: Piece) {
  return getAbsolutePoints(piece).every((point) => {
    const inBounds = point.x >= 0 && point.x < COLS && point.y >= 0 && point.y < ROWS;
    const empty = !inBounds || board.value[point.y][point.x] === "";
    return inBounds && empty;
  });
}

function getAbsolutePoints(piece: Piece) {
  return piece.shape.map((point) => ({
    x: point.x + piece.position.x,
    y: point.y + piece.position.y,
  }));
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
  timer = window.setInterval(tick, TICK_MS);
}

function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

function endGame() {
  gameOver.value = true;
  paused.value = false;
  stopTimer();
}

function handleKey(event: KeyboardEvent) {
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    resetGame();
    started.value = true;
    startTimer();
    return;
  }

  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (!started.value || gameOver.value) {
    startGame();
  }

  if (!running.value) return;

  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    event.preventDefault();
    movePiece(-1, 0);
  } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    event.preventDefault();
    movePiece(1, 0);
  } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
    event.preventDefault();
    if (movePiece(0, 1)) score.value += 1;
  } else if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
    event.preventDefault();
    rotatePiece();
  } else if (event.key === " ") {
    event.preventDefault();
    hardDrop();
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
    if (!started.value || gameOver.value) {
      startGame();
    } else if (running.value) {
      hardDrop();
    }
    touchStartX = 0;
    touchStartY = 0;
    return;
  }

  if (!started.value || gameOver.value) {
    startGame();
  }

  if (!running.value) {
    touchStartX = 0;
    touchStartY = 0;
    return;
  }

  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 0) {
      movePiece(1, 0);
    } else {
      movePiece(-1, 0);
    }
  } else {
    if (diffY > 0) {
      if (movePiece(0, 1)) score.value += 1;
    } else {
      rotatePiece();
    }
  }

  touchStartX = 0;
  touchStartY = 0;
}

function focusBoard() {
  nextTick(() => boardRef.value?.focus());
}

onMounted(() => {
  resetGame();
  window.addEventListener("keydown", handleKey);
  boardRef.value?.addEventListener("touchstart", handleTouchStart, { passive: true });
  boardRef.value?.addEventListener("touchend", handleTouchEnd, { passive: true });
  focusBoard();
});

onUnmounted(() => {
  stopTimer();
  window.removeEventListener("keydown", handleKey);
  boardRef.value?.removeEventListener("touchstart", handleTouchStart);
  boardRef.value?.removeEventListener("touchend", handleTouchEnd);
});
</script>

<style scoped>
.tetris-game {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 32px;
  background:
    linear-gradient(135deg, rgba(21, 29, 46, 0.94), rgba(11, 13, 20, 0.98)),
    radial-gradient(circle at top left, rgba(77, 213, 255, 0.18), transparent 34%);
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
  color: #071019;
  background: #72d7ff;
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
  color: #72d7ff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #ffffff;
  font-size: 44px;
  line-height: 1;
  letter-spacing: 0;
}

.scoreboard {
  display: flex;
  gap: 10px;
}

.scoreboard div,
.status,
.next-piece {
  min-width: 96px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 11, 13, 0.48);
}

.scoreboard span,
.status span,
.next-piece > span {
  display: block;
  margin-bottom: 3px;
  color: #aeb9c8;
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
  grid-template-columns: minmax(260px, 340px) 240px;
  gap: 22px;
  align-items: start;
}

.tetris-board {
  --cell-size: clamp(18px, 3vw, 32px);
  position: relative;
  display: grid;
  grid-template-columns: repeat(10, var(--cell-size));
  grid-template-rows: repeat(20, var(--cell-size));
  width: calc(var(--cell-size) * 10);
  height: calc(var(--cell-size) * 20);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: #0b1320;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
  outline: none;
}

.tetris-board:focus-visible {
  border-color: #72d7ff;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.34),
    0 0 0 3px rgba(114, 215, 255, 0.28);
}

.cell {
  width: var(--cell-size);
  height: var(--cell-size);
  background: rgba(255, 255, 255, 0.025);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.mini-board {
  display: grid;
  grid-template-columns: repeat(4, 20px);
  grid-template-rows: repeat(4, 20px);
  gap: 3px;
  margin-top: 10px;
}

.mini-cell {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
}

.piece-I,
.piece-O,
.piece-T,
.piece-S,
.piece-Z,
.piece-J,
.piece-L {
  border-radius: 4px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    inset 0 -4px 0 rgba(0, 0, 0, 0.16);
}

.piece-I {
  background: #36c9f7;
}

.piece-O {
  background: #ffd84d;
}

.piece-T {
  background: #b16cff;
}

.piece-S {
  background: #62d26f;
}

.piece-Z {
  background: #ff5c65;
}

.piece-J {
  background: #4d7dff;
}

.piece-L {
  background: #ff9b3d;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  background: rgba(7, 10, 16, 0.72);
  text-align: center;
}

.overlay strong {
  color: #ffffff;
  font-size: 28px;
}

.overlay span {
  color: #d9e8f2;
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
  color: #071019;
  background: #72d7ff;
  font-weight: 900;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #a8e7ff;
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
  color: #aeb9c8;
  font-size: 13px;
}

.keys dd {
  margin: 2px 0 0;
  color: #ffffff;
  font-weight: 800;
}

@media (max-width: 760px) {
  .tetris-game {
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

  .game-nav {
    display: flex;
    flex-wrap: wrap;
  }
}
</style>
