# syntax=docker/dockerfile:1
# MyToken —— 多阶段构建，产出两个镜像 target：
#   - build : 共享构建阶段（npm ci + 前端 build + 后端 build:server）
#   - web   : nginx 静态托管 dist + /api 反代（rebuild.py 用 --target web）
#   - server: node:20-alpine 跑 Express 代理（rebuild.py 用 --target server）
# 构建方式（见 rebuild.py，仓库地址经 .env 注入，绝不硬编码）：
#   docker build --target web   -t <reg>/mytoken-web:latest   .
#   docker build --target server -t <reg>/mytoken-server:latest .

# ---------- Stage 1: 构建（前端 dist + 后端 server/dist） ----------
FROM node:20-alpine AS build
WORKDIR /app
# 先只拷依赖清单，利用层缓存
COPY package.json package-lock.json* ./
RUN npm ci
# 拷源码后构建
COPY . .
RUN npm run build && npm run build:server

# ---------- Stage 2a: server 运行时（Express 代理，端口 8788） ----------
FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
# 只装生产依赖（express），镜像尽量小
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
# 后端编译产物
COPY --from=build /app/server/dist ./server/dist
EXPOSE 8788
# 端口默认 8788，可用 PORT 覆盖
CMD ["node", "server/dist/index.js"]

# ---------- Stage 2b: web 运行时（nginx，SPA + /api 反代） ----------
FROM nginx:alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
