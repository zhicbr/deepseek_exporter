/**
 * =================================================================
 * DeepSeek Exporter - 核心提取引擎 (v4.0.0 - 功能增强版)
 * =================================================================
 * 新增功能：可以根据选项只导出 ASSISTANT 的消息。
 */

// --- STAGE 1: 网络拦截器 ---
if (!window.ds_exporter_fetch_injected) {
    window.ds_exporter_fetch_injected = true;
    window.DS_EXPORTER_STORE = { active_chat_session_id: null };

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const [url] = args;
        const response = await originalFetch(...args);
        if (typeof url === 'string' && url.includes('/api/v0/chat/history_messages')) {
            try {
                const data = await response.clone().json();
                if (data?.data?.biz_data?.chat_session?.id) {
                    const sessionId = data.data.biz_data.chat_session.id;
                    window.DS_EXPORTER_STORE.active_chat_session_id = sessionId;
                }
            } catch (e) { /* 忽略解析错误 */ }
        }
        return response;
    };
}

// --- STAGE 2: 数据库读取与导出逻辑 ---
function getConversationFromDB(dbName, storeName, key) {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(dbName);
        request.onerror = (event) => reject(`数据库错误: ${request.error}`);
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                return reject(`对象存储 ${storeName} 未找到`);
            }
            const transaction = db.transaction(storeName, "readonly");
            const objectStore = transaction.objectStore(storeName);
            const getRequest = objectStore.get(key);
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = (event) => reject(`获取数据失败: ${event.target.error}`);
        };
    });
}

// 函数接收一个 options 对象
async function extractConversation(options = { formulaStyle: 'default', exportMode: 'all' }) {
    try {
        const { formulaStyle, exportMode } = options;
        const DB_NAME = "deepseek-chat";
        const STORE_NAME = "history-message";
        let conversationId = null;

        if (window.DS_EXPORTER_STORE && window.DS_EXPORTER_STORE.active_chat_session_id) {
            conversationId = window.DS_EXPORTER_STORE.active_chat_session_id;
        }
        
        if (!conversationId) {
            try {
                const pathParts = window.location.pathname.split('/');
                const idIndex = pathParts.indexOf('s');
                if (idIndex !== -1 && pathParts.length > idIndex + 1) {
                    conversationId = pathParts[idIndex + 1];
                }
            } catch(e) { /* 忽略URL解析错误 */ }
        }

        if (!conversationId) {
            return { success: false, error: "无法确定对话ID, 请刷新或发起新对话。" };
        }

        const dbData = await getConversationFromDB(DB_NAME, STORE_NAME, conversationId);
        if (!dbData || !dbData.data) {
            return { success: false, error: "数据库中未找到该对话的数据，请刷新网页后重新导出。" };
        }

        const title = dbData.data.chat_session.title;
        const messages = dbData.data.chat_messages;
        let fullMarkdown = '';

        messages.forEach(msg => {
            let content = msg.content || '';
            const role = msg.role;

            // 【新增逻辑】根据 exportMode 决定是否跳过用户消息
            if (exportMode === 'assistant_only' && role === 'USER') {
                return; // 跳过当前循环
            }
            
            if (role === 'USER') {
                fullMarkdown += `# 🧑‍💻 用户\n\n${content.trim()}\n\n---\n\n`;
            } else if (role === 'ASSISTANT') {
                
                if (formulaStyle === 'default') {
                    content = content.replace(/\\\[(.*?)\\\]/gs, '$$$1$$');
                    content = content.replace(/\\\((.*?)\\\)/g, (match, group1) => `$${group1}$`);
                }
                
                fullMarkdown += `# 🤖 DeepSeek\n\n${content.trim()}\n\n---\n\n`;
            }
        });

        if (fullMarkdown.endsWith('---\n\n')) {
            fullMarkdown = fullMarkdown.slice(0, -5);
        }

        return { success: true, title, content: fullMarkdown };

    } catch (error) {
        console.error("DS Exporter: 提取时发生意外错误", error);
        return { success: false, error: `发生意外错误: ${error.message}` };
    }
}