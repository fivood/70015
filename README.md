# Web Toolbox — Image Converter

一个针对 Web 使用的纯前端图片格式转换工具。全部处理在浏览器内完成，**图片不上传服务器**，适合个人制作网站时快速生成 WebP / AVIF / JPEG / PNG 素材。

这是「个人便捷工具箱」的第一个模块，后续会陆续加入更多小工具。

## ✨ 功能

- 🖼️ **多格式互转**：WebP、AVIF、JPEG、PNG
- 📦 **批量处理**：一次拖拽多张图片
- 📐 **尺寸调整**：按宽度 / 高度 / 最大边 / 自定义等比例缩放
- 🎛️ **质量调节**：滑动调节压缩质量
- 🗜️ **打包下载**：支持单张下载或整批导出 ZIP
- 📱 **移动端优先**：参考你给定的深色 + 桃橙 UI 风格，自适应手机屏
- 🔒 **隐私安全**：纯 Canvas 前端转换，无服务器上传

## 🚀 在线使用

通过 GitHub Pages 部署：

👉 **https://fukkix.github.io/web-toolbox/**

> 如果 AVIF 导出在你的浏览器不可用，会自动降级为 WebP。

## 🛠️ 本地运行

无需构建工具，直接打开即可：

```bash
git clone https://github.com/fukkix/web-toolbox.git
cd web-toolbox
# 直接用浏览器打开 index.html，或起一个静态服务器
npx serve .
```

## 🧰 技术栈

- HTML5 Canvas API（核心转换）
- 原生 JavaScript（无框架）
- JSZip + FileSaver.js（打包下载）
- GitHub Pages（部署）

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

MIT © fukkix
