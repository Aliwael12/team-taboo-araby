// Unit tests for normalization + scoring across franco and Arabic.
// Run: node scripts/testMatching.js
const { normalize, scoreGuess } = require('../server/matching');
const engine = require('../server/engine');

let pass = 0, fail = 0;
const eq = (name, a, b) => {
  const ok = a === b;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `  (got ${JSON.stringify(a)} , want ${JSON.stringify(b)})`}`);
  ok ? pass++ : fail++;
};

// --- normalization: different spellings should collapse to the same key ---
eq('alef/ya variants unify', normalize('أحلام الفتى الطايش'), normalize('احلام الفتي الطايش'));
eq('madda alef unifies', normalize('آسف على الإزعاج'), normalize('اسف علي الازعاج'));
eq('taa marbuta == ha', normalize('صاحبة السعاده'), normalize('صاحبه السعاده'));
eq('arabic digits -> latin', normalize('١٠٠٠ مبروك'), normalize('1000 مبروك'));
eq('tashkeel ignored', normalize('ريّح المدام'), normalize('ريح المدام'));
eq('franco lowercases/trims', normalize('  El   Kebeer '), 'el kebeer');
eq('two different titles differ', normalize('تيتو') !== normalize('سوتس'), true);

// --- scoring against a built "turn" of the first 5 pool entries ---
const pool = engine.fullPool();
console.log(`\nPool size: ${pool.length}`);
const findByFr = (fr) => pool.find((p) => p.display.fr === fr);

function wordsFrom(frs) {
  return frs.map((fr) => {
    const item = findByFr(fr);
    return { display: item.display, forms: item.forms, solved: false };
  });
}

// Use a spread of titles including short + multiword ones.
const words = wordsFrom(['Tito', 'El kebeer', '1000 mabrook', 'Asef 3al ez3ag', 'Suits']);
const nameAt = (i) => words[i].display.fr;

const scoreOne = (guess) => scoreGuess(guess, words);

eq('franco exact -> exact@0', JSON.stringify(scoreOne('Tito')), JSON.stringify({ status: 'exact', index: 0 }));
eq('arabic exact -> exact@1', scoreOne('الكبير أوي').status, 'exact');
eq('arabic variant (no hamza) -> exact@1', scoreOne('الكبير اوي').status, 'exact');
eq('arabic-digit title -> exact@2', scoreOne('١٠٠٠ مبروك').status, 'exact');
eq('franco alt for #2 -> exact@2', scoreOne('1000 mabrook').status, 'exact');
eq('typo franco -> close', scoreOne('Titoo').status, 'close');
eq('typo arabic -> close', scoreOne('اسف علي الازعاجج').status, 'close');
eq('gibberish -> none', scoreOne('zzzzzz qwerty').status, 'none');
eq('unrelated real title -> none', scoreOne('الناظر').status, 'none');

// duplicate: solve #0 then guess it again
words[0].solved = true;
eq('already-solved -> duplicate', scoreOne('Tito').status, 'duplicate');
words[0].solved = false;

// index correctness
eq('exact returns right index', scoreOne('Suits').index, 4);

console.log(`\n${fail === 0 ? '🎉 ALL PASSED' : '⚠️  ' + fail + ' FAILED'} (${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);
