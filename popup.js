/**
 * popup.js (最终架构修复版)
 * 增加了 world: 'MAIN' 配置，确保脚本在正确的上下文中执行。
 */
document.getElementById('exportBtn').addEventListener('click', () => {
    const formulaStyle = document.getElementById('formulaStyle').value;
    updateStatus("正在提取...", false);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].id) {
            console.error("DS Exporter: 无法获取当前标签页。");
            updateStatus("无法访问当前页面", true);
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            // 【关键修正】
            // 指定函数在页面的“主世界”中执行，
            // 确保它可以找到由 content.js 定义的 extractConversation 函数。
            world: 'MAIN',
            func: (style) => extractConversation(style),
            args: [formulaStyle]
        }, 
        (injectionResults) => {
            if (chrome.runtime.lastError) {
                console.error("DS Exporter: 脚本注入或执行时出错: ", chrome.runtime.lastError.message);
                updateStatus(`脚本注入失败: ${chrome.runtime.lastError.message}`, true);
                return;
            }
            if (!injectionResults || !injectionResults[0] || !injectionResults[0].result) {
                console.error("DS Exporter: 脚本没有返回结果。");
                updateStatus("未能提取到内容 (无结果返回)", true);
                return;
            }

            const result = injectionResults[0].result;
            if (result && result.success) {
                if (result.content) {
                    downloadMarkdown(result.title, result.content);
                    updateStatus("导出成功！");
                } else {
                    updateStatus("提取内容为空", true);
                }
            } else {
                console.error("DS Exporter: 提取失败，原因:", result.error);
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