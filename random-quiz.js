'use strict';
const quizLines=text=>[...new Set(String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean))];

// Comparison only: never rewrite the user's recipe or the displayed answer.
function quizComparisonText(value){
 return String(value||'').normalize('NFKC').toLowerCase()
  .replace(/^\s*(?:\d+[.)、]|[-•·])\s*/, '')
  .replace(/\d+(?:\.\d+)?\s*(?:ml|㎖|g|그램|밀리리터|회|번|펌프|스푼|스쿱|샷|개)\b/gi,' ')
  .replace(/\d+(?:\.\d+)?\s*(?:그램|밀리리터|회|번|펌프|스푼|스쿱|샷|개)(?=\s|$|[.,])/g,' ')
  .replace(/([가-힣]{2,})(?:을|를|으로|에다가|에|부터)(?=\s)/g,'$1')
  .replace(/(?:해주세요|해 주세요|합니다|하기|한다|해요|하기로|한다음|한 다음)/g,'')
  .replace(/(?:넣어주세요|넣어 주세요|넣는다|넣어요|넣기|넣고|붓는다|붓기|부어요|첨가|추가|투입)/g,'넣')
  .replace(/(?:저어주기|저어 주기|저어준다|젓기|섞는다|섞기|믹싱|혼합)/g,'섞')
  .replace(/(?:스티밍|스팀하기|스팀|steaming|steam)/g,'스팀')
  .replace(/(?:휘핑크림|휩크림|whipped cream)/g,'휘핑')
  .replace(/(?:에스프레소|에스프레쏘|espresso)/g,'에스프레소')
  .replace(/[^a-z0-9가-힣]/g,'');
}
function quizTextSimilarity(a,b){
 if(a===b)return 1;
 const grams=s=>{const m=new Map();for(let i=0;i<s.length-1;i++){const g=s.slice(i,i+2);m.set(g,(m.get(g)||0)+1);}return m;};
 const x=grams(a),y=grams(b);let shared=0;
 for(const [g,n] of x)shared+=Math.min(n,y.get(g)||0);
 return a.length+b.length>2?2*shared/(a.length+b.length-2):0;
}
function quizChoicesTooSimilar(left,right){
 const a=quizComparisonText(left),b=quizComparisonText(right);
 if(!a||!b)return true;
 if(a===b)return true;
 // A shorter answer contained in a longer one is often also a valid answer.
 // Applies to any entered words, not a fixed list of recipe names.
 if(Math.min(a.length,b.length)>=2&&(a.includes(b)||b.includes(a)))return true;
 if(quizTextSimilarity(a,b)>=.72)return true;
 // Catch small spelling differences without equating unrelated short words.
 if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>Math.max(a.length,b.length)*.22)return false;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[b.length]/Math.max(a.length,b.length)<=.22;
}
function quizDistinctDistractors(candidates,correctAnswers){
 const selected=[];
 for(const candidate of shuffle([...new Set(candidates)])){
  if(!String(candidate||'').trim()||[...correctAnswers,...selected].some(answer=>quizChoicesTooSimilar(candidate,answer)))continue;
  selected.push(candidate);if(selected.length===3)break;
 }
 return selected;
}

function buildRandomQuestions(recipes,mode='all',limit=10){
 const source=recipes.filter(r=>!r.demo),questions=[];
 for(const r of source){
  if(mode==='all'||mode==='quantity')for(const [key,label] of Object.entries(QUANTITIES)){
   if(!r.size||r[key]===undefined||r[key]===''||!Number.isFinite(Number(r[key])))continue;
   const correct=Number(r[key]);if(correct<0)continue;
   const truth=Math.random()<.5,delta=correct%1===0?1:.5;
   const shown=truth?correct:(correct>=delta&&Math.random()<.5?correct-delta:correct+delta);
   if(!truth&&shown===correct)continue;
   questions.push({r,kind:'quantity',prompt:`${label}은(는) ${shown}회 들어간다.`,options:['O','X'],answer:truth?'O':'X',explanation:`등록된 ${label} 횟수: ${correct}회`});
  }
  if(mode==='all'||mode==='ingredient'){
   const own=quizLines(r.ingredients),others=quizDistinctDistractors(source.flatMap(x=>quizLines(x.ingredients)),own);
   if(own.length&&others.length){const answer=shuffle([...own])[0];questions.push({r,kind:'ingredient',prompt:'이 음료에 들어가는 재료는 무엇일까요?',answer,options:shuffle([answer,...others]),explanation:`등록된 재료:\n${r.ingredients}`});}
  }
  if(mode==='all'||mode==='first'){
   const answer=String(r.first||'').trim(),others=quizDistinctDistractors(source.map(x=>String(x.first||'').trim()),[answer]);
   if(answer&&others.length)questions.push({r,kind:'first',prompt:'등록한 레시피에서 가장 먼저 할 행동은 무엇일까요?',answer,options:shuffle([answer,...others]),explanation:`등록된 첫 행동:\n${answer}`});
  }
  if(mode==='all'||mode==='order'){
   const steps=String(r.steps||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
   if(steps.length>=2&&new Set(steps).size>=2){const options=shuffle(steps.map((text,id)=>({text,id})));if(options.every((o,i)=>o.id===i))options.push(options.shift());questions.push({r,kind:'order',prompt:'제조 순서대로 보기를 눌러 주세요.',steps,options,explanation:`등록된 제조 순서:\n${steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}`});}
  }
 }
 return shuffle(questions).slice(0,limit);
}
let randomQuestions=[],randomIndex=0,randomScore=0,randomAnswered=false,randomSelected=[];
function finishRandomQuiz(stopped=false){$('random-session').hidden=true;$('random-setup').hidden=false;$('random-summary').textContent=`${stopped?'연습 종료':'연습 완료'} · ${randomIndex}문제 중 ${randomScore}문제 정답`;randomQuestions=[];}
function renderRandomQuiz(){
 if(randomIndex>=randomQuestions.length){finishRandomQuiz();return;}
 randomAnswered=false;randomSelected=[];const q=randomQuestions[randomIndex];
 $('random-position').textContent=`${randomIndex+1} / ${randomQuestions.length}`;
 $('random-card').innerHTML=`<div class="badges"><span class="badge">${esc(TYPES[q.r.temperature])}</span><span class="badge">${esc(sizeLabel(q.r.size))}</span><span class="badge">${q.kind==='quantity'?'OX':q.kind==='ingredient'?'재료':q.kind==='first'?'첫 행동':'제조 순서'}</span></div><h2>${esc(q.r.name)}</h2><p class="question">${esc(q.prompt)}</p><div class="random-options">${q.options.map((o,i)=>`<button type="button" class="secondary random-choice" data-choice="${i}">${esc(q.kind==='order'?o.text:o)}</button>`).join('')}</div>${q.kind==='order'?'<p id="random-selected" class="small" aria-live="polite">선택한 순서가 여기에 표시돼요.</p><div class="random-actions"><button id="random-undo" class="secondary">다시 고르기</button><button id="random-check" class="primary" disabled>정답 확인</button></div>':''}<div id="random-feedback" role="status" aria-live="polite"></div><button id="random-next" class="primary" hidden>다음 문제</button>`;
 $('random-card').onclick=e=>{const b=e.target.closest('button[data-choice]');if(!b||randomAnswered||b.disabled)return;const i=Number(b.dataset.choice);if(q.kind!=='order'){answerRandomQuiz(q.options[i]===q.answer);return;}randomSelected.push(q.options[i]);b.disabled=true;$('random-selected').textContent=randomSelected.map((o,n)=>`${n+1}. ${o.text}`).join('\n');$('random-check').disabled=randomSelected.length!==q.steps.length;};
 if(q.kind==='order'){$('random-undo').onclick=renderRandomQuiz;$('random-check').onclick=()=>{if(randomSelected.length===q.steps.length)answerRandomQuiz(randomSelected.every((o,i)=>o.text===q.steps[i]));};}
 $('random-next').onclick=()=>{randomIndex++;renderRandomQuiz();};
}
function answerRandomQuiz(ok){
 if(randomAnswered)return;randomAnswered=true;const q=randomQuestions[randomIndex];if(ok)randomScore++;
 // Preserve existing review flags; a single correct detail does not prove the whole recipe was recalled.
 if(data.recipes.some(r=>r.id===q.r.id)){const prev=data.record[q.r.id]||{};data.record[q.r.id]={...prev,attempts:(prev.attempts||0)+1,wrong:!ok||!!prev.wrong};save();}
 $('random-card').querySelectorAll('button[data-choice],#random-check,#random-undo').forEach(b=>b.disabled=true);
 $('random-feedback').innerHTML=`<div class="answer"><h3>${ok?'정답이에요!':'다시 확인해 보세요.'}</h3><p>${esc(q.explanation)}</p>${!ok?'<p class="small">내 레시피의 ‘다시 연습할 음료’에 표시했어요.</p>':''}</div>`;
 $('random-next').hidden=false;$('random-next').textContent=randomIndex+1===randomQuestions.length?'결과 보기':'다음 문제';
}
$('random-start').onclick=()=>{const requested=Number($('random-count').value);if(!Number.isSafeInteger(requested)||requested<1){$('random-summary').textContent='문제 수를 1 이상의 정수로 입력해 주세요.';return;}randomQuestions=buildRandomQuestions(data.recipes,$('random-mode').value,requested);if(randomQuestions.length&&randomQuestions.length<requested)toast(`출제 가능한 ${randomQuestions.length}문제로 시작해요.`);randomIndex=0;randomScore=0;if(!randomQuestions.length){$('random-summary').textContent='출제할 내용이 부족해요. 레시피에 사이즈와 횟수, 재료, 첫 행동 또는 두 줄 이상의 제조 순서를 등록해 주세요.';return;}$('random-setup').hidden=true;$('random-session').hidden=false;renderRandomQuiz();};
$('random-stop').onclick=()=>{if(!confirm('퀴즈를 취소하고 첫 화면으로 돌아갈까요? 지금까지 푼 문제의 기록은 저장돼요.'))return;if(randomAnswered)randomIndex++;finishRandomQuiz(true);$('random-setup').scrollIntoView({block:'start'});};

function updateRandomAvailable(){const n=buildRandomQuestions(data.recipes,$('random-mode').value,Infinity).length;$('random-available').textContent=`현재 출제 가능: ${n}문제 · 입력한 수보다 부족하면 가능한 문제만 출제해요.`;}
$('random-mode').onchange=updateRandomAvailable;
updateRandomAvailable();
