# 下载与安装 / Download and install

浏览器插件不再是「发布到商店」的路线,而是由网页版直接提供下载。

- 在线页面: <https://70015.net/install>
- 下载文件: `downloads/70015-chromium.zip`(构建产物,由 `node extension/build.js --zip` 生成)

支持 Chrome 102+ 与 Edge 102+(基于 `chrome.scripting` 与 Manifest V3)。

## 安装步骤

1. 在 `/install` 点击下载,得到 `70015-chromium.zip`。
2. 解压到一个**之后不会删除或移动**的目录。解压后的文件夹里应当直接有 `manifest.json`。
3. 地址栏输入 `chrome://extensions`(Edge 为 `edge://extensions`)并回车。
4. 打开右上角「开发者模式」,点「加载已解压的扩展程序」,选中第 2 步的文件夹。

因为是从文件而非商店安装,浏览器**不会自动更新**它。发布新版本后,重新下载解压,在扩展页面点一次「重新加载」即可。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Alt+Shift+F` | 截取整个页面 |
| `Alt+Shift+V` | 截取可见区域 |
| `Alt+Shift+S` | 截取选定区域(拖拽画框,滚轮或拖到边缘可延伸,Esc 取消) |

可在 `chrome://extensions/shortcuts` 修改。

## 本地预览下载页

```bash
cd web-toolbox
npx --yes serve .
# 然后打开 http://localhost:3000/install
```

## 版本更新流程

```bash
# 1. 改 extension/manifest.src.json 里的 version
# 2. 把 install.html 里 ins_meta 那行的版本号与体积同步改掉（版本是写死的，见下）
# 3. 重新构建并打包（--zip 会把 Chromium 包写到 downloads/）
node extension/build.js --zip
# 4. 提交 downloads/70015-chromium.zip 与 install.html
```

**版本号在 `install.html` 里是写死的**，不是占位符。原因：Cloudflare Pages 直接以仓库原文
部署（`pages deploy .`），**不会运行 `extension/build.js`**，所以任何构建期替换在线上都不生效。
改版本时必须手动同步那一行。`__VERSION__` 这个占位符只有扩展构建产物会用（供扩展内部页面
显示版本），站点页面不用它。

## 关于部署

已实测确认的两点：

- `dist/` 在 `.gitignore` 中，Cloudflare Pages 遵循它，**构建产物目录不会上线**
  （访问任意 `/dist/**` 路径会落到 index.html 回退页）。
- 反过来，仓库里的**原始文件是会公开的**，包括 `/extension/**`（如 `manifest.src.json`、
  `build.js`、`popup/popup.js`）与 `js/`、`css/`、`vendor/`。如果不想公开这些源码，需要把
  站点源文件移到一个专门的发布目录，或改用「构建后部署」而不是「部署仓库原文」。


## 说明

- `extension/` 目录**故意不含** `manifest.json`,浏览器无法直接加载它(缺 `js/`、`css/` 等共享文件);
  只有 `dist/extension/` 是可加载产物。这是有意设计,不要「修」。
- Firefox 版本 `dist/70015-firefox-<version>.zip` 仅供本地测试,未在页面提供,因为 Firefox
  默认拒绝安装未签名扩展。
