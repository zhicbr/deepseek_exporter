/**
 * popup.js (v4.0.0 - 功能增强版)
 * - 支持自定义文件名前后缀
 * - 支持只导出 Assistant 消息
 */
document.getElementById('exportBtn').addEventListener('click', () => {
    // 1. 从UI获取所有选项
    const options = {
        formulaStyle: document.getElementById('formulaStyle').value,
        filePrefix: document.getElementById('filePrefix').value.trim(),
        fileSuffix: document.getElementById('fileSuffix').value.trim(),
        exportMode: document.getElementById('assistantOnly').checked ? 'assistant_only' : 'all'
    };

    updateStatus("正在提取...", false);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].id) {
            updateStatus("无法访问当前页面", true);
            return;
        }

        // 2. 将需要注入的选项传递给内容脚本
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            world: 'MAIN',
            func: (opts) => extractConversation(opts),
            args: [{ formulaStyle: options.formulaStyle, exportMode: options.exportMode }]
        }, 
        (injectionResults) => {
            if (chrome.runtime.lastError) {
                updateStatus(`脚本注入失败: ${chrome.runtime.lastError.message}`, true);
                return;
            }
            if (!injectionResults || !injectionResults[0] || !injectionResults[0].result) {
                updateStatus("未能提取到内容 (无结果返回)", true);
                return;
            }

            const result = injectionResults[0].result;
            if (result && result.success) {
                if (result.content) {
                    // 3. 调用下载函数，并传入所有选项用于命名
                    downloadMarkdown(result.title, result.content, options);
                    updateStatus("导出成功！");
                } else {
                    updateStatus("提取内容为空", true);
                }
            } else {
                updateStatus(`提取失败: ${result.error}`, true);
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
    }, isError ? 10000 : 3000);
}

// 下载函数现在使用选项来构造最终文件名
function downloadMarkdown(title, text, options) {
    // 处理文件名中的非法字符
    const safeTitle = title.replace(/[\/|\\|:|*|?|"|<|>|\|]/g, '_');
    // 使用前缀和后缀拼接
    const filename = `${options.filePrefix}${safeTitle}${options.fileSuffix}.md`;
    
    const file = new Blob([text], {type: 'text/markdown;charset=utf-8'});
    const element = document.createElement('a');
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
}