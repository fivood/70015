# 70015 — Web Toolbox

一个黑白灰极简风格的个人 Web 工具箱，所有处理在浏览器内完成，图片与数据不上传服务器。

目前已包含两个模块：
- **图片转换**：批量转换 WebP / AVIF / JPEG / PNG / ICO，支持压缩、缩放、裁剪与打包下载
- **配色板**：上传图片或拖拽文件夹，自动提取主色调并生成 Web 设计参考色板

## 功能

- **多格式互转**：WebP、AVIF、JPEG、PNG、ICO
- **批量处理**：一次拖拽多张图片
- **尺寸调整**：按宽度 / 高度 / 最大边 / 自定义等比例缩放
- **质量调节**：滑动调节压缩质量
- **打包下载**：支持单张下载或整批导出 ZIP
- **ICO 多尺寸**：可选 16/32/48/64/128/256 px，自动生成 favicon
- **配色板生成**：从参考图中提取主色，复制 HEX / RGB / CSS 变量，导出 JSON
- **移动端优先**：黑白灰极简风格，自适应手机屏
- **隐私安全**：纯 Canvas 前端处理，无服务器上传

## 在线使用

主站（自定义域名）：

**https://70015.net/**

备用地址：

- GitHub Pages：https://fivood.github.io/70015/
- Cloudflare Pages：https://70015.pages.dev/

如果 AVIF 导出在你的浏览器不可用，会自动降级为 WebP。

## 绑定自定义域名 70015.net

本仓库已通过 GitHub Actions 自动部署到 Cloudflare Pages。如需将 `70015.net` 绑定到该项目：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → 选择项目 **70015**
3. 点击 **Custom domains** → **Set up a custom domain**
4. 输入 `70015.net`，按向导完成验证
5. 如果域名已在 Cloudflare 管理，系统会自动添加 DNS 记录；否则需要手动添加 CNAME：
   - 类型：`CNAME`
   - 名称：`@` 或 `70015.net`
   - 目标：`70015.pages.dev`
6. 等待 SSL 证书自动颁发，通常几分钟内生效

## 自动部署到 Cloudflare Pages

本仓库已内置 GitHub Actions 工作流（`.github/workflows/deploy-cloudflare.yml`），每次 push 到 `master` 分支会自动部署到 Cloudflare Pages。

### 配置步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 获取 **Account ID**：在右侧边栏找到并复制
3. 创建 **API Token**：
   - 进入 [My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - 点击 **Create Token**
   - 使用 **Custom token**，权限选择：
     - `Cloudflare Pages` → `Edit`
     - `Account` → `Cloudflare Pages` → `Read`（部分模板需要）
   - 账户资源选择你的账户
4. 在 GitHub 仓库设置中添加 Secrets：
   - 打开 `https://github.com/fivood/70015/settings/secrets/actions`
   - 新建 `CLOUDFLARE_API_TOKEN`，粘贴刚才创建的 Token
   - 新建 `CLOUDFLARE_ACCOUNT_ID`，粘贴 Account ID
5. 首次部署前，需要先在 Cloudflare Pages 创建项目：
   - 方式 A（推荐）：在 Cloudflare Dashboard → Pages → Create a project → Connect to Git，选择 `fivood/70015`，设置 Build command 为空、Output directory 为 `.`，然后保存。之后 GitHub Actions 会自动接管部署。
   - 方式 B（命令行）：安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 后运行 `wrangler pages project create 70015`
6. Push 任意更新到 `master`，Actions 会自动部署，通常 1–2 分钟内生效。

## 本地运行

无需构建工具，直接打开即可：

```bash
git clone https://github.com/fivood/70015.git
cd 70015
# 直接用浏览器打开 index.html，或起一个静态服务器
npx serve .
```

## 技术栈

- HTML5 Canvas API（核心转换）
- 原生 JavaScript（无框架）
- JSZip + FileSaver.js（打包下载）
- GitHub Pages + Cloudflare Pages（双部署）

## 参考项目

在实现过程中参考了以下 GitHub 项目的思路：

- [diegoddp/webp-converter](https://github.com/diegoddp/webp-converter) — 浏览器端 WebP 转换 + JSZip 打包
- [incubated-geek-cc/canvas-frames-to-GIF](https://github.com/incubated-geek-cc/canvas-frames-to-GIF) — Canvas 帧合成 GIF
- [Tezumie/Image-to-triangle](https://github.com/Tezumie/Image-to-triangle) — 无依赖浏览器端图像处理

## 设计

黑白灰极简风格：

- 主背景：`#0a0a0a`
- 卡片表面：`#111111`
- 次级表面：`#1a1a1a`
- 强调色：`#ffffff`
- 次要文字：`#a3a3a3`
- 弱化文字：`#737373`

界面图标均使用 SVG，未使用 emoji。

## License

MIT © fivood
