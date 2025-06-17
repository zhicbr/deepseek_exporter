/**
 * popup.js
 * (V3 - 最终修复版) - 修正了 executeScript 的函数调用方式，确保按钮功能正常。
 */

document.getElementById('exportBtn').addEventListener('click', () => {
    // 1. 获取用户选择的公式风格
    const formulaStyle = document.getElementById('formulaStyle').value;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].id) {
            console.error("无法获取当前标签页。");
            updateStatus("无法访问当前页面", true);
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            
            // 【关键修正】
            // 修正了上一版中的错误，恢复使用正确的“信使函数”调用方式。
            // 同时将 formulaStyle 作为参数传递给它。
            func: (style) => extractConversation(style),
            args: [formulaStyle]

        }, 
        (injectionResults) => {
            if (chrome.runtime.lastError) {
                console.error("脚本注入或执行时出错: ", chrome.runtime.lastError.message);
                updateStatus("导出失败，请检查控制台", true);
                return;
            }
            if (!injectionResults || !injectionResults[0]) {
                console.error("脚本没有返回结果。");
                updateStatus("未能提取到内容", true);
                return;
            }

            const result = injectionResults[0].result;
            if (result && result.content) {
                downloadMarkdown(result.title, result.content);
                updateStatus("导出成功！");
            } else {
                updateStatus("未能提取到内容", true);
            }
        });
    });
});

function updateStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#D32F2F' : '#4CAF50';
    setTimeout(() => {
        statusEl.textContent = '';
    }, 3000);
}

function downloadMarkdown(filename, text) {
    const safeFilename = filename.replace(/[\/|\\|:|*|?|"|<|>|\|]/g, '_') + '.md';
    const file = new Blob([text], {type: 'text/markdown;charset=utf-8'});
    const element = document.createElement('a');
    element.href = URL.createObjectURL(file);
    element.download = safeFilename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}