/**
 * Content Parser - 智能识别考试题型并生成卡片
 * 支持：名词解释、简答题、论述题、选择题、填空题
 */

const Parser = {
  /**
   * 主入口：解析文本为卡片数组
   * @param {string} text - 原始文本
   * @returns {Array} [{front, back, type}]
   */
  parse(text) {
    // 预处理：统一换行、去除多余空白
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/\t/g, '  ');
    
    let cards = [];
    
    // 按优先级尝试各种解析策略
    cards = cards.concat(this.parseNamedExplanation(text));   // 名词解释
    cards = cards.concat(this.parseNumberedQA(text));          // 编号问答
    cards = cards.concat(this.parseQuestionAnswer(text));      // 问/答格式
    cards = cards.concat(this.parseChoiceQuestions(text));     // 选择题
    cards = cards.concat(this.parseFillBlanks(text));          // 填空题
    cards = cards.concat(this.parseDashFormat(text));          // 破折号格式
    cards = cards.concat(this.parseColonFormat(text));         // 冒号格式
    
    // 去重（基于 front 内容）
    const seen = new Set();
    cards = cards.filter(c => {
      const key = c.front.trim().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return cards;
  },

  /**
   * 名词解释格式：
   * XXX：解释内容
   * XXX——解释内容
   * 名词：XXX  解释：XXX
   */
  parseNamedExplanation(text) {
    const cards = [];
    
    // 模式1：名词：解释（单行）
    const re1 = /^[\s]*(?:名词|概念|术语|定义)[：:]\s*(.+?)[\n]+[\s]*(?:解释|含义|定义|释义|意思)[：:]\s*(.+?)$/gm;
    let m;
    while ((m = re1.exec(text)) !== null) {
      cards.push({ front: m[1].trim(), back: m[2].trim(), type: '名词解释' });
    }
    
    // 模式2：XXX：YYY（如果 YYY 超过20字，可能是名词解释）
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^([^：:]{2,20})[：:]\s*(.{20,})$/);
      if (match) {
        const term = match[1].trim();
        const explanation = match[2].trim();
        // 排除标题行和章节标记
        if (!term.match(/^(第[一二三四五六七八九十]+[章节]|[一二三四五六七八九十]+[、.])/)) {
          cards.push({ front: term, back: explanation, type: '名词解释' });
        }
      }
    }
    
    return cards;
  },

  /**
   * 编号问答格式：
   * 1. 问题内容？
   * 答案/答案内容
   * 
   * （一）问题
   * 答案
   */
  parseNumberedQA(text) {
    const cards = [];
    
    // 按编号分割（1. 2. 3. 或 （一）（二） 或 一、二、）
    const sections = text.split(/(?=^(?:[\s]*(?:\d+[.、．)）]|[（(][一二三四五六七八九十\d]+[）)]|(?:一|二|三|四|五|六|七|八|九|十)[、.])).*$)/m);
    
    for (const section of sections) {
      if (section.trim().length < 10) continue;
      
      // 提取编号后的内容
      const match = section.match(/^[\s]*(?:\d+[.、．)）]|[（(][一二三四五六七八九十\d]+[）)]|(?:一|二|三|四|五|六|七|八|九|十)[、.])\s*([\s\S]+)$/);
      if (!match) continue;
      
      const content = match[1].trim();
      
      // 尝试在内容中找 问/答 分割
      const qaSplit = content.split(/(?:^|\n)\s*(?:答[案：:]?|参考答案|Answer)[：:]?\s*/i);
      if (qaSplit.length >= 2) {
        const question = qaSplit[0].trim();
        const answer = qaSplit.slice(1).join('\n').trim();
        if (question.length > 2 && answer.length > 2) {
          cards.push({ front: question, back: answer, type: this.guessType(question, answer) });
          continue;
        }
      }
      
      // 如果没有明确的答标记，尝试用换行分割（第一行=问题，后面=答案）
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        const question = lines[0].trim();
        const answer = lines.slice(1).join('\n').trim();
        if (question.length > 2 && answer.length > 5) {
          cards.push({ front: question, back: answer, type: this.guessType(question, answer) });
        }
      }
    }
    
    return cards;
  },

  /**
   * 问/答格式：
   * 问：XXX
   * 答：XXX
   * 
   * Q: XXX
   * A: XXX
   */
  parseQuestionAnswer(text) {
    const cards = [];
    
    const re = /(?:问|Q|Question|问题|题目)[：:.]?\s*([\s\S]+?)(?:\n\s*(?:答|A|Answer|答案|参考答案)[：:.]?\s*([\s\S]+?))(?=(?:\n\s*(?:问|Q|Question|问题|题目)[：:.]?)|$)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const front = m[1].trim();
      const back = m[2].trim();
      if (front.length > 2 && back.length > 2) {
        cards.push({ front, back, type: this.guessType(front, back) });
      }
    }
    
    return cards;
  },

  /**
   * 选择题格式：
   * 1. 问题？ A.xx B.xx C.xx D.xx 答案：A
   */
  parseChoiceQuestions(text) {
    const cards = [];
    
    // 匹配含 A/B/C/D 选项的题目
    const re = /(?:^|\n)\s*(\d+[.、．)）]?\s*.+?\?)\s*[\n\s]*A[.、．:：)\s]\s*(.+?)[\n\s]*B[.、．:：)\s]\s*(.+?)[\n\s]*C[.、．:：)\s]\s*(.+?)[\n\s]*D[.、．:：)\s]\s*(.+?)(?:[\n\s]*(?:答案|正确答案|Answer)[：:.]?\s*([A-D]))?/gm;
    
    let m;
    while ((m = re.exec(text)) !== null) {
      const question = m[1].trim();
      const options = `A. ${m[2].trim()}\nB. ${m[3].trim()}\nC. ${m[4].trim()}\nD. ${m[5].trim()}`;
      const answer = m[6] ? `\n\n正确答案：${m[6]}` : '';
      cards.push({ front: question, back: options + answer, type: '选择题' });
    }
    
    return cards;
  },

  /**
   * 填空题格式：
   * XXX（___）YYY，答案：ZZZ
   */
  parseFillBlanks(text) {
    const cards = [];
    
    const lines = text.split('\n');
    for (const line of lines) {
      // 匹配含空格标记的行
      const match = line.match(/(.+?(?:_{2,}|（\s*）|\(\s*\)).+?)(?:\s*[，,]\s*(?:答案|答|Answer)[：:.]?\s*(.+))?$/i);
      if (match && match[2]) {
        cards.push({ front: match[1].trim(), back: match[2].trim(), type: '填空题' });
      }
    }
    
    return cards;
  },

  /**
   * 破折号格式：
   * XXX —— YYY
   * XXX — YYY
   */
  parseDashFormat(text) {
    const cards = [];
    
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^(.{2,30})\s*[—–-]{1,2}\s*(.{5,})$/);
      if (match) {
        cards.push({ front: match[1].trim(), back: match[2].trim(), type: '名词解释' });
      }
    }
    
    return cards;
  },

  /**
   * 冒号分隔的 key-value 格式（短 key + 长 value）
   */
  parseColonFormat(text) {
    const cards = [];
    const seen = new Set();
    
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^(.{2,25})[：:]\s*(.{10,})$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (!seen.has(key) && !key.match(/^(第[一二三四五六七八九十]+[章节]|[\d]+[.、])/)) {
          seen.add(key);
          cards.push({ front: key, back: val, type: '名词解释' });
        }
      }
    }
    
    return cards;
  },

  /**
   * 根据问题和答案长度猜测题型
   */
  guessType(question, answer) {
    if (answer.length < 50) return '简答题';
    if (answer.length > 200) return '论述题';
    if (question.match(/名词|概念|术语|什么是|含义|定义/)) return '名词解释';
    return '简答题';
  }
};