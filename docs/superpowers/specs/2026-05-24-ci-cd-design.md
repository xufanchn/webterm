# CI/CD 打包部署设计

## 目标

推送 `v*` 标签自动触发：交叉编译（linux/amd64+arm64, darwin/amd64+arm64, windows/amd64）、打包 tar.gz/zip、构建 Docker 镜像、创建 GitHub Release。

## 工具选择

GoReleaser — Go 生态主流发布工具。一条命令完成编译、打包、checksum、Docker 构建推送、GitHub Release。

## 新增文件

### `.goreleaser.yml`

```yaml
builds:
  - id: webterm
    main: .
    binary: webterm
    env: [CGO_ENABLED=0]
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]
    ignore:
      - goos: windows
        goarch: arm64
    ldflags: ["-s -w -X main.version={{.Version}}"]
    hooks:
      pre:
        - cmd: cd ui && npm ci && npm run build
          output: true

archives:
  - formats: [tar.gz]
    files: [config.yaml]
    format_overrides:
      - goos: windows
        formats: [zip]

dockers:
  - image_templates:
      - "ghcr.io/xufanchn/webterm:{{.Version}}-amd64"
    dockerfile: Dockerfile
    use: buildx
    build_flag_templates:
      - "--platform=linux/amd64"
  - image_templates:
      - "ghcr.io/xufanchn/webterm:{{.Version}}-arm64"
    dockerfile: Dockerfile
    use: buildx
    build_flag_templates:
      - "--platform=linux/arm64"

docker_manifests:
  - name_template: "ghcr.io/xufanchn/webterm:{{.Version}}"
    image_templates:
      - "ghcr.io/xufanchn/webterm:{{.Version}}-amd64"
      - "ghcr.io/xufanchn/webterm:{{.Version}}-arm64"
  - name_template: "ghcr.io/xufanchn/webterm:latest"
    image_templates:
      - "ghcr.io/xufanchn/webterm:{{.Version}}-amd64"
      - "ghcr.io/xufanchn/webterm:{{.Version}}-arm64"

checksum:
  name_template: "checksums.txt"

release:
  draft: false

changelog:
  use: github-native
```

### `Dockerfile`

多阶段构建：

1. **node:22-alpine** — 编译 React 前端（npm ci + npm run build）
2. **golang:1.26-alpine** — 编译 Go 后端（go build，内嵌 frontend/dist）
3. **alpine:3.21** — 运行镜像

```dockerfile
FROM node:22-alpine AS frontend
WORKDIR /src
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/dist ./frontend/dist
RUN CGO_ENABLED=0 go build -ldflags "-s -w -X main.version={{.Version}}" -o webterm .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
EXPOSE 8888
COPY --from=backend /src/webterm /usr/local/bin/webterm
ENTRYPOINT ["webterm"]
```

### `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-go@v5
        with:
          go-version: "1.26"

      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: goreleaser/goreleaser-action@v6
        with:
          distribution: goreleaser
          version: "~> v2"
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 使用方式

```bash
# 发布新版本
git tag v1.0.0
git push --tags
# CI 自动完成所有打包发布
```

### 二进制部署

```bash
wget https://github.com/xufanchn/webterm/releases/download/v1.0.0/webterm_v1.0.0_linux_amd64.tar.gz
tar xzf webterm_v1.0.0_linux_amd64.tar.gz
# 编辑 config.yaml
./webterm -config config.yaml
```

### Docker 部署

```bash
docker run -d -p 8888:8888 \
  -v ./config.yaml:/config.yaml \
  ghcr.io/xufanchn/webterm:v1.0.0
```

## 产物

每个 Release 包含：

- `webterm_v1.0.0_linux_amd64.tar.gz`
- `webterm_v1.0.0_linux_arm64.tar.gz`
- `webterm_v1.0.0_darwin_amd64.tar.gz`
- `webterm_v1.0.0_darwin_arm64.tar.gz`
- `webterm_v1.0.0_windows_amd64.zip`
- `checksums.txt`
- Docker 镜像 `ghcr.io/xufanchn/webterm:v1.0.0` 和 `:latest`
