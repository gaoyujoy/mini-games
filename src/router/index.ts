import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Snake",
    component: () => import("../views/Snake.vue"),
  },
  {
    path: "/2048",
    name: "Game2048",
    component: () => import("../views/Game2048.vue"),
  },
  {
    path: "/tetris",
    name: "Tetris",
    component: () => import("../views/Tetris.vue"),
  },
  {
    path: "/gomoku",
    name: "Gomoku",
    component: () => import("../views/Gomoku.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
