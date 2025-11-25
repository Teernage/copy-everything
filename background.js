chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

// 点击图标打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 消息处理
chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.action === 'captureVisible') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      res({ success: !chrome.runtime.lastError, dataUrl });
    });
    return true;
  }
});
