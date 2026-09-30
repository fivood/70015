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
# 2. 重新构建并打包(--zip 会把 Chromium 包写到 downloads/)
node extension/build.js --zip
# 3. 提交 downloads/70015-chromium.zip 与 dist/ 下的产物
```

`{{VERSION}}` 占位符由构建脚本替换为 manifest 中的版本号,因此 `/install` 页面上的版本会自动跟随。

## 关于部署

Cloudflare Pages 遵循 `.gitignore`,而 `dist/` 已在其中,所以构建产物目录**不会上线**;
站点只提供 `downloads/70015-chromium.zip`。`dist/` 下的旧命名包(`70015-chromium-<version>.zip`)
由构建脚本保留,同样不会被部署。

## 说明

- `extension/` 目录**故意不含** `manifest.json`,浏览器无法直接加载它(缺 `js/`、`css/` 等共享文件);
  只有 `dist/extension/` 是可加载产物。这是有意设计,不要「修」。
- Firefox 版本 `dist/70015-firefox-<version>.zip` 仅供本地测试,未在页面提供,因为 Firefox
  默认拒绝安装未签名扩展。
