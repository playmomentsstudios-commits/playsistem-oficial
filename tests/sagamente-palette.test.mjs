import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Brand palette no longer uses legacy red tokens',()=>{
 const css=read('src/index.css');
 assert.match(css,/--color-brand-dim: #81431E/);
 assert.match(css,/--color-brand-ink: #DFA269/);
 assert.match(css,/\.pm-eyebrow \{\s*color: #DFA269/);
 assert.doesNotMatch(css,/--color-brand-dim: #b30010/);
 assert.match(css,/\.pm-tag-progress \{ --pm-tag-color: #f59e0b/);
 assert.match(css,/\.pm-tag-review \{ --pm-tag-color: #3b82f6/);
 assert.match(css,/\.pm-tag-pending \{ --pm-tag-color: #8b8b98/);
});
test('Alert and danger colors remain distinct from brand copper',()=>{
 const css=read('src/index.css');
 assert.match(css,/\.pm-tag-danger \{ --pm-tag-color: #ef4444/);
 assert.match(css,/\.staff-workspace :is\(\.bg-red-500/);
 assert.match(css,/\.staff-workspace \.bg-\\\[\\#A65A2A/);
});
test('Hero aurora and category accents use the chosen palette',()=>{
 const lab=read('src/components/public/PlayLabExperience.tsx');
 assert.doesNotMatch(lab,/#7a3cff/i);
 const cat=read('src/pages/public/CategoryPage.tsx');
 assert.doesNotMatch(cat,/#ff6b35|#4cc9f0|#06d6a0/i);
});
