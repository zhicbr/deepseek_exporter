/**
 * =================================================================
 * DeepSeek Exporter - 核心提取引擎 (最终完美版)
 * -----------------------------------------------------------------
 * 修复了表格单元格内公式 `\|` 被错误转义的最终bug。
 * 这是包含所有功能和修复的最终生产版本。
 * =================================================================
 */

function convertNodeToMarkdown(node, context) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';
    if (node.tagName === 'BR') return '  \n';

    if (node.matches && (node.matches('.katex-display') || node.matches('.katex'))) {
        const annotation = node.querySelector('annotation');
        if (annotation && annotation.textContent) {
            const latexSource = annotation.textContent.trim();
            if (node.classList.contains('katex-display')) {
                return context.formulaStyle === 'latex' ? `\\[${latexSource}\\]` : `$$${latexSource}$$`;
            } else {
                return context.formulaStyle === 'latex' ? `\\(${latexSource}\\)` : `$${latexSource}$`;
            }
        }
    }

    let innerMarkdown = '';
    if (node.hasChildNodes()) {
        const newContext = { ...context };
        if (node.tagName === 'UL' || node.tagName === 'OL') {
            newContext.listDepth = (context.listDepth || 0) + 1;
        }
        node.childNodes.forEach(child => {
            innerMarkdown += convertNodeToMarkdown(child, newContext);
        });
    }

    switch (node.tagName.toLowerCase()) {
        case 'strong': case 'b': return `**${innerMarkdown}**`;
        case 'em': case 'i': return `*${innerMarkdown}*`;
        case 'p': return innerMarkdown;
        case 'li':
            const indent = '  '.repeat(context.listDepth - 1);
            const bullet = node.parentElement.tagName === 'OL' ? `${Array.from(node.parentElement.children).indexOf(node) + 1}. ` : '* ';
            return `${indent}${bullet}${innerMarkdown.trim()}\n`;
        case 'ul': case 'ol': return innerMarkdown.trim();
        case 'h3': return `### ${innerMarkdown}`;
        case 'hr': return '---\n';
        case 'a': return `[${innerMarkdown}](${node.getAttribute('href') || ''})`;
        case 'blockquote': return `> ${innerMarkdown.replace(/\n/g, '\n> ')}`;
        default: return innerMarkdown;
    }
}

function buildMarkdownTable(tableNode, context) {
    const tableRows = [];
    
    const processCell = (cellNode) => {
        let content = convertNodeToMarkdown(cellNode, context).trim();
        content = content.replace(/\n/g, '<br>'); // 保留单元格内换行
        // 【关键修复】使用更智能的正则表达式，只转义那些前面不是反斜杠的'|'
        content = content.replace(/(?<!\\)\|/g, '\\|');
        return content;
    };
    
    const headerRow = tableNode.querySelector('thead > tr');
    if (headerRow) {
        const headers = Array.from(headerRow.children).map(th => processCell(th));
        tableRows.push(`| ${headers.join(' | ')} |`);
        tableRows.push(`| ${headers.map(() => '---').join(' | ')} |`);
    }

    const bodyRows = tableNode.querySelectorAll('tbody > tr');
    bodyRows.forEach(row => {
        const cells = Array.from(row.children).map(td => processCell(td));
        tableRows.push(`| ${cells.join(' | ')} |`);
    });

    return `\n\n${tableRows.join('\n')}\n\n`;
}


function extractConversation(formulaStyle = 'default') {
    const SELECTORS = {
        title: '.d8ed659a',
        messagesContainer: '.dad65929',
        userBlockClass: '_9663006',
        userContent: '.fbb737a4',
        aiBlockClass: '_4f9bf79',
        aiContentWrapper: '.ds-markdown.ds-markdown--block'
    };

    const titleElement = document.querySelector(SELECTORS.title);
    const conversationTitle = titleElement ? titleElement.innerText.trim() : '未命名对话';

    const messagesContainer = document.querySelector(SELECTORS.messagesContainer);
    if (!messagesContainer) return null;

    const messageBlocks = messagesContainer.querySelectorAll(':scope > div');
    let fullMarkdown = '';

    messageBlocks.forEach(block => {
        if (block.classList.contains(SELECTORS.userBlockClass)) {
            const userContentElement = block.querySelector(SELECTORS.userContent);
            if (userContentElement) {
                fullMarkdown += '### 🧑‍💻 用户\n\n' + userContentElement.innerText.trim() + '\n\n---\n\n';
            }
        } else if (block.classList.contains(SELECTORS.aiBlockClass)) {
            const aiContentWrapper = block.querySelector(SELECTORS.aiContentWrapper);
            if (aiContentWrapper) {
                fullMarkdown += '### 🤖 DeepSeek\n\n';
                
                const context = { formulaStyle: formulaStyle, listDepth: 0 };
                let contentParts = [];

                aiContentWrapper.childNodes.forEach(childNode => {
                    if (childNode.nodeType !== 1) return;

                    if (childNode.matches && childNode.matches('div.markdown-table-wrapper')) {
                        const table = childNode.querySelector('table');
                        if (table) {
                            contentParts.push(buildMarkdownTable(table, context));
                        }
                    } else {
                        const convertedPart = convertNodeToMarkdown(childNode, context);
                        if (convertedPart && convertedPart.trim() !== '') {
                            contentParts.push(convertedPart.trim());
                        }
                    }
                });
                
                fullMarkdown += contentParts.join('\n\n') + '\n\n---\n\n';
            }
        }
    });

    return {
        title: conversationTitle,
        content: fullMarkdown.replace(/\n{3,}/g, '\n\n').trim()
    };
}