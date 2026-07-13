# Web Toolbox — Image Converter

一个针对 Web 使用的纯前端图片格式转换工具。全部处理在浏览器内完成，**图片不上传服务器**，适合个人制作网站时快速生成 WebP / AVIF / JPEG / PNG / ICO 素材。

这是「个人便捷工具箱」的第一个模块，后续会陆续加入更多小工具。

## ✨ 功能

- 🖼️ **多格式互转**：WebP、AVIF、JPEG、PNG、ICO
- 📦 **批量处理**：一次拖拽多张图片
- 📐 **尺寸调整**：按宽度 / 高度 / 最大边 / 自定义等比例缩放
- 🎛️ **质量调节**：滑动调节压缩质量
- 🗜️ **打包下载**：支持单张下载或整批导出 ZIP
- 📱 **移动端优先**：参考你给定的深色 + 桃橙 UI 风格，自适应手机屏
- 🔒 **隐私安全**：纯 Canvas 前端转换，无服务器上传

## 🚀 在线使用

通过 GitHub Pages 部署：

👉 **https://fivood.github.io/70015/**

通过 Cloudflare Pages 部署（自动同步）：

👉 **https://web-toolbox.pages.dev/**（需按下方步骤配置后生效）

> 如果 AVIF 导出在你的浏览器不可用，会自动降级为 WebP。

## ☁️ 自动部署到 Cloudflare Pages

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
   - 方式 B（命令行）：安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 后运行 `wrangler pages project create web-toolbox`
6. Push 任意更新到 `master`，Actions 会自动部署，通常 1–2 分钟内生效。

## 🛠️ 本地运行

无需构建工具，直接打开即可：

```bash
git clone https://github.com/fivood/70015.git
cd web-toolbox
# 直接用浏览器打开 index.html，或起一个静态服务器
npx serve .
```

## 🧰 技术栈

- HTML5 Canvas API（核心转换）
- 原生 JavaScript（无框架）
- JSZip + FileSaver.js（打包下载）
- GitHub Pages + Cloudflare Pages（双部署）

## 📚 参考项目

在实现过程中参考了以下 GitHub 项目的思路：

- [diegoddp/webp-converter](https://github.com/diegoddp/webp-converter) — 浏览器端 WebP 转换 + JSZip 打包
- [incubated-geek-cc/canvas-frames-to-GIF](https://github.com/incubated-geek-cc/canvas-frames-to-GIF) — Canvas 帧合成 GIF
- [Tezumie/Image-to-triangle](https://github.com/Tezumie/Image-to-triangle) — 无依赖浏览器端图像处理

## 🎨 设计

颜色与风格来自你提供的移动端 UI 参考图：

- 主背景：`#0f0f1e`
- 卡片表面：`#16162a`
- 强调色（桃橙）：`#f4a261`
- 次要强调（暖橙）：`#e76f51`

## 📄 License

MIT © fivood
