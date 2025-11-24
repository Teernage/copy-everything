/**
 * 获取元素引用
 * @param {string} id 元素id
 * @returns {HTMLElement} 元素引用
 */
const $ = (id) => document.getElementById(id);

/**
 * 显示元素
 * @param {string} id 元素id
 * @param {boolean} visible 是否可见
 */
const show = (id, visible = true) => {
  const el = $(id);
  const displayValue = el.classList.contains('modal') ? 'flex' : 'block';
  el.style.display = visible ? displayValue : 'none';
};

/**
 * 隐藏元素
 * @param {string} id 元素id
 */
const hide = (id) => show(id, false);

/**
 * 绑定点击事件
 * @param {*} pairs 元素id和点击事件处理函数的数组
 */
const bindClicks = (pairs) =>
  pairs.forEach(([id, handler]) => {
    const el = $(id);
    if (el) el.onclick = handler;
  });

let currentImage = ''; // 当前显示的图片
let currentDataUrl = ''; // 当前显示的图片的base64编码
let isAreaCapturing = false; // 是否正在进行区域截图
/**
 * 设置区域截图状态
 * @param {boolean} busy 区域截图是否进行中
 */
function setCaptureBusy(busy) {
  isAreaCapturing = busy;
  ['captureVisible', 'captureArea'].forEach((id) => {
    const btn = $(id);
    if (btn) btn.disabled = busy;
  });
}

// 初始化
(async () => {
  const { secretId, secretKey } = await chrome.storage.local.get([
    'secretId',
    'secretKey',
  ]);
  if (secretId && secretKey) {
    $('secretId').value = secretId;
    $('secretKey').value = secretKey;
    showSection('upload');
  }

  // 事件绑定
  // 初始化事件绑定片段
  $('unlockBtn').onclick = unlock;
  $('saveBtn').onclick = saveConfig;
  $('screenshotBtn').onclick = () => show('modal');
  $('fileInput').onchange = (e) =>
    e.target.files[0] && handleFile(e.target.files[0]);
  $('closeModal').onclick = () => hide('modal');
  $('captureVisible').onclick = captureVisible;
  $('captureArea').onclick = captureArea;
  $('recognizeBtn').onclick = recognize;
  $('reuploadBtn').onclick = () => {
    resetFileInput();
    showSection('upload');
  };
  $('copyBtn').onclick = copy;
  $('downloadBtn').onclick = download;
  $('resetBtn').onclick = () => showSection('upload');
  $('dropZone').onclick = () => {
    resetFileInput();
    $('fileInput').click();
  };
  $('modal').onclick = (e) => e.target === $('modal') && hide('modal');

  setupDragDrop();

  // 监听自选区域截图完成（在初始化 IIFE 内）
  (() => {
    chrome.runtime.onMessage.addListener((req) => {
      if (req.action === 'areaCaptureDone') {
        setCaptureBusy(false);
        hide('modal');
        handleImage(req.dataUrl);
      } else if (req.action === 'areaCaptureCancelled') {
        setCaptureBusy(false);
      }
    });
  })();
})();

/**
 * 设置拖拽上传区域的事件监听
 */
function setupDragDrop() {
  const zone = $('dropZone');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((e) => {
    zone.addEventListener(e, (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
  });
  ['dragenter', 'dragover'].forEach((e) =>
    zone.addEventListener(e, () => zone.classList.add('drag-over'))
  );
  ['dragleave', 'drop'].forEach((e) =>
    zone.addEventListener(e, () => zone.classList.remove('drag-over'))
  );
  zone.addEventListener(
    'drop',
    (e) => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0])
  );
}

/**
 * 解除复制限制，允许用户复制文本
 */
async function unlock() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id, { action: 'unlockCopy' });
    toast('✓ 已解除所有限制', 'success');
  } catch {
    toast('请刷新页面后重试', 'error');
  }
}

/**
 * 保存配置
 */
async function saveConfig() {
  const secretId = $('secretId').value.trim();
  const secretKey = $('secretKey').value.trim();
  if (!secretId || !secretKey) return toast('请填写完整信息', 'error');
  await chrome.storage.local.set({ secretId, secretKey });
  toast('保存成功', 'success');
  setTimeout(() => showSection('upload'), 1000);
}

/**
 * 截取当前可见区域的图片
 */
async function captureVisible() {
  if (isAreaCapturing) return toast('请先完成或取消自选区域', 'error');
  hide('modal');
  toast('正在截图...', 'success');
  chrome.runtime.sendMessage({ action: 'captureVisible' }, (res) => {
    res.success
      ? (handleImage(res.dataUrl), toast('✓ 截图成功', 'success'))
      : toast('截图失败', 'error');
  });
}

/**
 * 启动自选区域截图
 */
async function captureArea() {
  hide('modal');
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id, { action: 'startAreaCapture' });
    setCaptureBusy(true);
    toast('请在页面上拖动选择区域', 'success');
  } catch {
    toast('请刷新页面后重试', 'error');
  }
}

/**
 * 处理上传的文件
 * @param {File} file 文件对象
 */
function handleFile(file) {
  if (!file.type.startsWith('image/')) return toast('请上传图片文件', 'error');
  const reader = new FileReader();
  reader.onload = (e) => handleImage(e.target.result);
  reader.readAsDataURL(file);
}

/**
 * 处理图片
 * @param {string} dataUrl 图片的 base64 编码
 */
function handleImage(dataUrl) {
  currentDataUrl = dataUrl;
  currentImage = dataUrl.split(',')[1];
  $('previewImg').src = dataUrl;
  showSection('preview');
}

/**
 * 识别图片中的文字
 */
async function recognize() {
  const { secretId, secretKey } = await chrome.storage.local.get([
    'secretId',
    'secretKey',
  ]);
  if (!secretId || !secretKey) return toast('请先配置 API 密钥', 'error');
  showSection('loading');
  try {
    const ocr = new TencentOCR(secretId, secretKey);
    const text = await ocr.recognizeText(currentImage);
    $('resultText').value = text;
    showSection('result');
    toast('✓ 识别成功', 'success');
  } catch (err) {
    toast('识别失败: ' + err.message, 'error');
    showSection('preview');
  }
}

/**
 * 复制识别结果
 */
function copy() {
  $('resultText').select();
  document.execCommand('copy');
  toast('✓ 已复制', 'success');
}

/**
 * 下载图片
 */
function download() {
  const a = document.createElement('a');
  a.href = currentDataUrl;
  a.download = `ocr-${Date.now()}.png`;
  a.click();
  toast('✓ 已下载', 'success');
}

/**
 * 显示指定的页面区域
 * @param {string} name 页面区域的 ID
 */
function showSection(name) {
  ['config', 'upload', 'preview', 'loading', 'result'].forEach((id) =>
    hide(id)
  );
  show(name);
}

function toast(text, type) {
  const el = $('toast');
  el.textContent = text;
  el.className = `toast ${type}`;
  show('toast');
  setTimeout(() => hide('toast'), 3000);
}

/**
 * 重置文件选择框
 */
function resetFileInput() {
  const input = $('fileInput');
  if (input) input.value = '';
}
