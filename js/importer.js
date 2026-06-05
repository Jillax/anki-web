/**
 * File Importer - 提取 PDF/DOCX/TXT 文件内容并导入为卡片
 * 使用 pdf.js (PDF) 和 mammoth.js (DOCX)
 */

const Importer = {
  rawText: '',
  parsedCards: [],

  /**
   * 处理文件上传
   * @param {File} file
   * @returns {Promise<string>} 提取的文本
   */
  async extractText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return await this.extractPDF(file);
    if (name.endsWith('.docx')) return await this.extractDOCX(file);
    if (name.endsWith('.doc')) { throw new Error('不支持 .doc 格式，请先转换为 .docx'); }
    if (name.endsWith('.txt') || name.endsWith('.md')) return await this.extractTXT(file);
    throw new Error('不支持的文件格式，请上传 PDF、DOCX 或 TXT 文件');
  },

  async extractPDF(file) {
    // 使用 pdf.js CDN
    if (!window.pdfjsLib) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      text += pageText + '\n\n';
    }
    return text.trim();
  },

  async extractDOCX(file) {
    // 使用 mammoth.js CDN
    if (!window.mammoth) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  },

  async extractTXT(file) {
    return await file.text();
  },

  /**
   * 加载外部 JS 脚本
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('加载脚本失败: ' + src));
      document.head.appendChild(s);
    });
  },

  /**
   * 正则解析
   */
  parseRegex(text) {
    return Parser.parse(text);
  },

  /**
   * AI 解析（调用用户配置的 API）
   */
  async parseAI(text, apiKey, apiBase, model) {
    if (!apiKey) throw new Error('请先在设置中配置 API Key');

    const baseUrl = apiBase || 'https://api.openai.com/v1';
    const modelName = model || 'gpt-4o-mini';

    // 截取前4000字避免超长
    const truncated = text.substring(0, 4000);

    const prompt = `你是一个考试复习助手。请分析以下文本，提取出所有可以作为复习卡片的问题-答案对。

要求：
1. 识别名词解释：名词 + 解释
2. 识别简答题/论述题：问题 + 答案
3. 识别选择题：题目 + 选项 + 正确答案
4. 识别填空题：含空格的句子 + 答案

请以 JSON 数组格式返回，每项包含：
- front: 问题/名词
- back: 答案/解释
- type: 题型（名词解释/简答题/论述题/选择题/填空题）

只返回 JSON 数组，不要其他内容。

文本内容：
${truncated}`;

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('API 调用失败: ' + err);
    }

    const data = await resp.json();
    const content = data.choices[0].message.content;

    // 提取 JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI 返回格式错误');

    return JSON.parse(jsonMatch[0]);
  },

  /**
   * MinerU 解析
   */
  async parseMinerU(file, mineruUrl) {
    if (!mineruUrl) throw new Error('请先在设置中配置 MinerU 服务地址');

    const formData = new FormData();
    formData.append('file', file);

    const resp = await fetch(`${mineruUrl}/predict`, {
      method: 'POST',
      body: formData
    });

    if (!resp.ok) throw new Error('MinerU 请求失败: ' + resp.statusText);

    const data = await resp.json();
    return data.markdown || data.text || '';
  },

  /**
   * 将解析后的卡片导入到指定牌组
   */
  async importToDeck(cards, deckId) {
    let count = 0;
    for (const c of cards) {
      if (c.front && c.back) {
        await DB.addCard({
          deckId: deckId,
          front: c.front,
          back: c.back,
          tags: c.type ? [c.type] : []
        });
        count++;
      }
    }
    return count;
  }
};