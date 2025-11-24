# 图文解锁器

一键解除网页复制/右键/选中限制，支持页面截图与自选区域截图，并使用腾讯云 OCR 进行文字识别。

## 功能特性

- 解除网页的复制/右键/选中限制
- 页面截图与拖拽上传图片，支持自选区域截图
- 腾讯云通用文字识别（GeneralBasicOCR），中文识别优化
- 侧边栏操作界面，识别结果一键复制、图片一键下载
- 本地保存 `SecretId`/`SecretKey`，不上传到第三方

## 安装与加载

1. 打开 Chrome/Edge 扩展页面：`chrome://extensions`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”，选择本项目目录 `unlock-copy-ocr`
4. 点击扩展图标即可打开侧边栏进行操作（需要 Chrome 114+ 的 `sidePanel` 支持）

## 使用指南

1. 在侧边栏“OCR 文字识别”卡片中，填写并保存腾讯云密钥：
   - `SecretId`、`SecretKey`（可在腾讯云访问管理获取）
2. 选择图片来源：
   - 页面截图：可见区域截图或拖拽自选区域
   - 本地图片：拖拽到上传区或点击选择文件
3. 点击“开始识别”，在结果区可一键复制识别文本或下载图片
4. 若网页存在复制限制，点击顶部卡片“一键解除”即可解锁

## 权限说明

- `activeTab`：用于获取当前标签页的可见区域截图
- `storage`：用于在本地保存 `SecretId`/`SecretKey`
- `sidePanel`：用于打开扩展侧边栏界面
- `host_permissions: <all_urls>`：让内容脚本可在各站点注入以解除复制/提供截图 UI

## 目录结构

- `manifest.json`：扩展配置（Manifest V3）
- `background.js`：后台服务工作线程，处理截图请求
- `content.js`：内容脚本，负责解除复制限制与自选区域截图 UI
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js`：侧边栏界面与交互逻辑
- `tencentOCR.js`：腾讯云 OCR 调用与签名实现（TC3-HMAC-SHA256）

## 隐私与安全

- 密钥仅保存于浏览器 `chrome.storage.local`，不上传到除腾讯云 OCR 以外的任何服务
- 仅向 `ocr.tencentcloudapi.com` 发送识别请求，不收集额外用户数据
- 建议妥善保管密钥，必要时在腾讯云控制台进行密钥轮换

## 常见问题

- 截图失败：请刷新页面后重试或确保当前标签页为活动页
- 取消自选区域：按 `Esc` 键可取消
- OCR 报错：检查密钥有效性与账单账户状态；默认地域为 `ap-guangzhou`，如需修改可在 `tencentOCR.js` 构造函数中调整
