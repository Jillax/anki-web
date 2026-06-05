const vm = require('vm');
const fs = require('fs');

const code = fs.readFileSync('d:/AI Related/Claws/anki-web/js/parser.js', 'utf-8');
vm.runInThisContext(code);

const testText = "\u8fd1\u4ee3\u53f2\u5b66\n\u4f0f\u5c14\u6cf0\n\u6cd5\u56fd\u542f\u8499\u601d\u60f3\u5bb6\n\u601d\u60f3\n\u5bf9\u5929\u4e3b\u6559\u4f1a\u505a\u4e86\u5927\u80c6\u7684\u653b\u51fb\n\u4ee3\u8868\u4f5c\uff1a\u300a\u54f2\u5b66\u901a\u4fe1\u300b\u300a\u8def\u6613\u5341\u56db\u65f6\u4ee3\u300b\u7b49\n\u5170\u514b\n\u4ee3\u8868\u4f5c\uff1a\u300a\u62c9\u4e01\u548c\u6761\u987f\u6c11\u65cf\u53f2\u300b\n\u5730\u4f4d\uff1a\"\u4ee5\u5ba2\u89c2\u6001\u5ea6\u548c\u79d1\u5b66\u65b9\u6cd5\u7814\u7a76\u5386\u53f2\u7684\u7b2c\u4e00\u4eba\"\n\u601d\u60f3\n\u5021\u5bfc\u5ba2\u89c2\u4e3b\u4e49\u53f2\u5b66\u7406\u8bba\u4f53\u7cfb\n\u7279\u7eb3\n\u7f8e\u56fd\u53f2\u5b66\u4e2d\"\u8fb9\u7586\u5b66\u6d3e\"\u7684\u521b\u59cb\u4eba\n\u7279\u7eb3\u5728\u300a\u8fb9\u7586\u5728\u7f8e\u56fd\u5386\u53f2\u4e0a\u7684\u91cd\u8981\u6027\u300b\u4e00\u6587\u4e2d\u5982\u4f55\u5b9a\u4e49\"\u8fb9\u7586\"\uff1f\n\u6700\u65e9\uff1a\u7011\u5e03\u7ebf\u2014\u963f\u52d2\u683c\u5c3c\u5c71\u8109\u2014\u5bc6\u897f\u897f\u6bd4\u6cb3\n\u8fb9\u7586\u662f\u5411\u897f\u65b9\u79fb\u6c11\u6d6a\u6f6e\u7684\u524d\u6cbf\n\u5982\u4f55\u7406\u89e3\u7279\u7eb3\u8bf4\u7684\u7f8e\u56fd\u601d\u60f3\u4e2d\u7684\u8fb9\u7586\u7279\u6027\uff1f\n\u8fb9\u7586\u5f62\u6210\u4e86\u7f8e\u56fd\u601d\u60f3\u7684\u663e\u8457\u7279\u6027\n\u7c97\u66b4\u5f3a\u5065";

const cards = Parser.parse(testText);
console.log('=== PARSE RESULTS ===');
console.log('Total cards:', cards.length);
console.log('');
cards.forEach((card, i) => {
  console.log('--- Card ' + (i+1) + ' [' + card.type + '] ---');
  console.log('Front:', card.front);
  console.log('Back preview:', card.back.substring(0, 200));
  console.log('Back length:', card.back.length);
  console.log('');
});

const issues = [];
const voltaire = cards.find(c => c.front === '\u4f0f\u5c14\u6cf0');
if (!voltaire) issues.push('FAIL: Voltaire not found');
else {
  if (!voltaire.back.includes('\u4ee3\u8868\u4f5c')) issues.push('FAIL: Voltaire missing works');
  if (voltaire.back.length < 50) issues.push('FAIL: Voltaire content too short');
}
const ranke = cards.find(c => c.front === '\u5170\u514b');
if (!ranke) issues.push('FAIL: Ranke not found');
else {
  if (!ranke.back.includes('\u5730\u4f4d')) issues.push('FAIL: Ranke missing status');
}
const qCards = cards.filter(c => c.front.includes('\uff1f'));
if (qCards.length < 1) issues.push('FAIL: No question cards');

console.log('\n=== VERIFICATION ===');
if (issues.length === 0) console.log('ALL TESTS PASSED!');
else { console.log('ISSUES:'); issues.forEach(i => console.log('  -', i)); }
