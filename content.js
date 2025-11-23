// ==================== 全局状态 ====================
let isSelecting = false; // 是否正在拖拽选区
let startPoint = { x: 0, y: 0 }; // 拖拽起点
let selectionBox = null; // 选区边框元素
let fullOverlay = null; // 全屏遮罩
let masks = []; // 4个遮罩块（上右下左）

// ==================== 消息监听 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'unlockCopy') {
    enableTextCopy();
    sendResponse({ success: true });
  } else if (request.action === 'startAreaCapture') {
    startScreenCapture();
    sendResponse({ success: true });
  }
  return true;
});

// ==================== 功能1: 解除复制限制 ====================
/**
 * 解除复制限制，允许用户复制文本
 */
function enableTextCopy() {
  if (window.__copyUnlocked) return;
  window.__copyUnlocked = true;

  // 1. 拦截所有限制事件
  const restrictedEvents = [
    'copy',
    'cut',
    'paste',
    'contextmenu',
    'selectstart',
    'dragstart',
    'keydown',
    'keyup',
    'keypress',
  ];
  const stopEvent = (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  };

  [window, document, document.documentElement, document.body].forEach(
    (target) => {
      if (target) {
        restrictedEvents.forEach((eventType) => {
          target.addEventListener(eventType, stopEvent, true);
        });
      }
    }
  );

  // 2. 强制允许文本选择
  const style = document.createElement('style');
  style.textContent = `
    html, body, * {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);

  // 3. 移除所有事件属性（如 oncopy="return false"）
  const eventAttrs = [
    'oncopy',
    'oncut',
    'onpaste',
    'oncontextmenu',
    'onselectstart',
    'onkeydown',
    'ondragstart',
  ];
  document
    .querySelectorAll(eventAttrs.map((a) => `[${a}]`).join(','))
    .forEach((el) => {
      eventAttrs.forEach((attr) => el.removeAttribute(attr));
    });

  // 4. 注入脚本禁用 preventDefault
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      if (window.__preventDefaultDisabled) return;
      window.__preventDefaultDisabled = true;
      const blockedEvents = new Set(${JSON.stringify(restrictedEvents)});
      const originalPreventDefault = Event.prototype.preventDefault;
      Event.prototype.preventDefault = function() {
        if (blockedEvents.has(this.type)) return;
        return originalPreventDefault.call(this);
      };
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();

  // 5. 监听动态添加的元素
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes?.forEach((node) => {
        if (node instanceof Element) {
          eventAttrs.forEach((attr) => node.removeAttribute(attr));
          node.style?.setProperty('user-select', 'text', 'important');
        }
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// ==================== 功能2: 区域截图 ====================
/**
 * 开始区域截图
 */
function startScreenCapture() {
  createCaptureUI();
  document.addEventListener('keydown', handleEscape);
}

/**
 * 创建截图UI，包括全屏半透明遮罩、4个遮罩块和选区边框
 */
function createCaptureUI() {
  // 全屏半透明遮罩
  fullOverlay = createDiv(`
    position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.5); z-index: 2147483646; cursor: crosshair;
  `);
  fullOverlay.addEventListener('mousedown', handleMouseDown);
  document.body.appendChild(fullOverlay);

  // 4个遮罩块（用于高亮选区）
  ['top', 'right', 'bottom', 'left'].forEach((position) => {
    const mask = createDiv(`
      position: fixed; background: rgba(0,0,0,0.5);
      z-index: 2147483646; pointer-events: none;
    `);
    mask.dataset.position = position;
    masks.push(mask);
    document.body.appendChild(mask);
  });

  // 选区边框
  selectionBox = createDiv(`
    position: fixed; border: 2px solid #1aad19;
    background: transparent; z-index: 2147483647;
    box-sizing: border-box; pointer-events: none;
    display: none;
  `);
  document.body.appendChild(selectionBox);

  // 绑定全局事件
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

/**
 * 创建div元素
 * @param {*} cssText 样式文本
 * @returns {HTMLDivElement} 创建的div元素
 */
function createDiv(cssText) {
  const div = document.createElement('div');
  div.style.cssText = cssText;
  return div;
}

/**
 * 处理鼠标按下事件，开始选区
 * @param {MouseEvent} e 鼠标事件对象
 */
function handleMouseDown(e) {
  e.preventDefault();
  isSelecting = true;
  startPoint = { x: e.clientX, y: e.clientY };

  // 隐藏全屏遮罩，显示选区框
  fullOverlay.style.display = 'none';
  selectionBox.style.display = 'block';

  updateSelection(e.clientX, e.clientY);
}

/**
 * 处理鼠标移动事件，更新选区
 * @param {MouseEvent} e 鼠标事件对象
 */
function handleMouseMove(e) {
  if (!isSelecting) return;
  updateSelection(e.clientX, e.clientY);
}

/**
 * 处理鼠标松开事件，完成截图
 */
function handleMouseUp() {
  if (!isSelecting) return;
  isSelecting = false;
  captureSelectedArea();
}

/**
 * 处理按键事件，按ESC取消截图
 * @param {KeyboardEvent} e 按键事件对象
 */
function handleEscape(e) {
  if (e.key === 'Escape') cleanupUI();
}
/**
 * 更新选区边框和4个遮罩块的位置
 * @param {number} currentX 当前鼠标X坐标
 * @param {number} currentY 当前鼠标Y坐标
 */
function updateSelection(currentX, currentY) {
  // 计算选区矩形
  const left = Math.max(0, Math.min(startPoint.x, currentX));
  const top = Math.max(0, Math.min(startPoint.y, currentY));
  const width = Math.max(1, Math.abs(currentX - startPoint.x));
  const height = Math.max(1, Math.abs(currentY - startPoint.y));

  // 更新选区边框
  Object.assign(selectionBox.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });

  // 更新4个遮罩块
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  masks[0].style.cssText += `left: 0; top: 0; width: ${vw}px; height: ${top}px;`; // 上
  masks[1].style.cssText += `left: ${left + width}px; top: ${top}px; width: ${
    vw - left - width
  }px; height: ${height}px;`; // 右
  masks[2].style.cssText += `left: 0; top: ${
    top + height
  }px; width: ${vw}px; height: ${vh - top - height}px;`; // 下
  masks[3].style.cssText += `left: 0; top: ${top}px; width: ${left}px; height: ${height}px;`; // 左
}

/**
 * 截取选中区域的图片，并发送给background脚本处理
 */
function captureSelectedArea() {
  const rect = {
    left: parseInt(selectionBox.style.left),
    top: parseInt(selectionBox.style.top),
    width: parseInt(selectionBox.style.width),
    height: parseInt(selectionBox.style.height),
  };

  cleanupUI();

  // 请求background截取可见区域
  chrome.runtime.sendMessage({ action: 'captureVisible' }, (response) => {
    if (response.success) {
      cropAndSendImage(response.dataUrl, rect);
    }
  });
}

/**
 * 裁剪图片并发送
 * @param {*} dataUrl 图片的DataURL格式字符串
 * @param {*} rect 选区矩形对象，包含left、top、width、height属性
 */
function cropAndSendImage(dataUrl, rect) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;

    // 设置画布大小（考虑设备像素比）
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;

    // 裁剪图片
    ctx.drawImage(
      img,
      rect.left * scale,
      rect.top * scale,
      rect.width * scale,
      rect.height * scale,
      0,
      0,
      rect.width * scale,
      rect.height * scale
    );

    // 发送截图数据
    chrome.runtime.sendMessage({
      action: 'areaCaptureDone',
      dataUrl: canvas.toDataURL('image/png'),
    });
  };
  img.src = dataUrl;
}

/**
 * 清理UI元素，包括遮罩、选区框、全屏遮罩和事件监听器
 */
function cleanupUI() {
  masks.forEach((mask) => mask.remove());
  masks = [];
  selectionBox?.remove();
  fullOverlay?.remove();
  document.removeEventListener('keydown', handleEscape);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
}
