'use strict';
const RECIPE_SORTS={newest:'최근 등록순',oldest:'오래된 등록순',updated:'최근 수정순',name:'가나다순',manual:'직접 정렬'};
const RECIPE_FIELDS=['name','size','temperature','ingredients','steps','first','note','shots','syrup','additives'];
function recipeTime(value){return Number.isSafeInteger(value)&&value>0&&value<=8640000000000000?value:0}
function recipeMetadata(r,i){return {...r,createdAt:recipeTime(r.createdAt),updatedAt:recipeTime(r.updatedAt)||recipeTime(r.createdAt),manualOrder:Number.isSafeInteger(r.manualOrder)&&r.manualOrder>=0?r.manualOrder:i}}
function getRecipeSort(){return Object.hasOwn(RECIPE_SORTS,data.sortMode)?data.sortMode:'newest'}
function sortRecipes(recipes,mode=getRecipeSort()){
 const positions=new Map(data.recipes.map((r,i)=>[r.id,i]));
 const position=r=>positions.get(r.id)??0;
 const created=(a,b)=>recipeTime(a.createdAt)-recipeTime(b.createdAt)||position(a)-position(b);
 return [...recipes].sort((a,b)=>mode==='oldest'?created(a,b):mode==='updated'?(recipeTime(b.updatedAt)-recipeTime(a.updatedAt)||-created(a,b)):mode==='name'?(a.name.localeCompare(b.name,'ko',{numeric:true,sensitivity:'base'})||created(a,b)):mode==='manual'?((a.manualOrder??position(a))-(b.manualOrder??position(b))||created(a,b)):-created(a,b));
}
function recipeMoveControls(r){return getRecipeSort()==='manual'?`<div class="recipe-move"><button type="button" class="drag-handle" data-drag-id="${esc(r.id)}" aria-label="${esc(r.name)} 순서 이동" title="끌어서 이동 · 키보드 위/아래 화살표로 이동">⠿</button><button type="button" class="move-step" data-move-id="${esc(r.id)}" data-direction="-1" aria-label="${esc(r.name)} 위로 이동">↑</button><button type="button" class="move-step" data-move-id="${esc(r.id)}" data-direction="1" aria-label="${esc(r.name)} 아래로 이동">↓</button></div>`:''}
function fillRecipeFields(r){
 document.querySelectorAll('#size option[data-legacy]').forEach(o=>o.remove());
 for(const k of RECIPE_FIELDS)if(k!=='size')$(k).value=r[k]??'';
 const selected=sizeKey(r.size||'');
 if(selected&&!Object.hasOwn(SIZES,selected)){const option=document.createElement('option');option.value=selected;option.textContent=sizeLabel(selected);option.dataset.legacy='true';$('size').append(option)}
 $('size').value=selected;
}
function openRecipeEditor(id=null,copyId=null){
 editing=id;$('form').reset();document.querySelectorAll('#size option[data-legacy]').forEach(o=>o.remove());
 const source=data.recipes.find(r=>r.id===(id||copyId));
 if((id||copyId)&&!source)return toast('레시피를 찾지 못했어요.');
 $('form-title').textContent=id?'레시피 수정':copyId?'레시피 복제':'레시피 추가';
 $('copy-source-wrap').hidden=!!id;
 $('copy-source').innerHTML='<option value="">새로 작성하기</option>'+data.recipes.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${esc(TYPES[r.temperature])} · ${esc(sizeLabel(r.size))}</option>`).join('');
 $('copy-source').value=copyId||'';
 if(source)fillRecipeFields(source);
 else {if(recipeCategory!=='all')$('temperature').value=recipeCategory;if(recipeSize!=='all'&&Object.hasOwn(SIZES,recipeSize))$('size').value=recipeSize}
 if(copyId)$('name').value=(source.name+' (복사)').slice(0,100);
 $('editor').showModal();
}
function saveRecipeEditor(e){
 e.preventDefault();if(!editing&&data.recipes.length>=2000)return toast('레시피는 최대 2,000개까지 저장할 수 있어요.');
 const original=editing?data.recipes.find(r=>r.id===editing):null;
 if(editing&&!original)return toast('수정할 레시피를 찾지 못했어요.');
 const now=Date.now(),r={...(original||{}),id:editing||crypto.randomUUID(),demo:false,createdAt:original?recipeTime(original.createdAt):now,updatedAt:now,manualOrder:original?.manualOrder??Math.max(-1,...data.recipes.map((x,i)=>x.manualOrder??i))+1};
 for(const k of RECIPE_FIELDS)r[k]=$(k).value.trim();
 if(!r.name||!Object.hasOwn(TYPES,r.temperature))return toast('음료 이름과 음료 종류를 입력해 주세요.');
 const previous=data;
 const record={...data.record};if(editing)delete record[editing];
 data={...data,recipes:editing?data.recipes.map(x=>x.id===editing?r:x):[...data.recipes,r],record};
 if(!save()){data=previous;return}
 if(recipeCategory!=='all')recipeCategory=r.temperature;
 if(recipeSize!=='all')recipeSize=sizeKey(r.size)||'all';
 $('editor').close();list();resetPractice();toast('레시피를 저장했어요.');
}
function visibleRecipeIds(){return [...$('recipe-list').querySelectorAll('[data-recipe-id]')].map(el=>el.dataset.recipeId)}
function saveRecipeOrder(ids,focusId){
 const all=sortRecipes(data.recipes,'manual'),visible=new Set(ids);let n=0;
 // Only replace the visible slots. Hidden recipes keep their relative positions.
 const byId=new Map(data.recipes.map(r=>[r.id,r]));
 const order=all.map(r=>visible.has(r.id)?byId.get(ids[n++]):r);
 const ranks=new Map(order.map((r,i)=>[r.id,i]));
 const previous=data,checked=[...$('recipe-list').querySelectorAll('[data-select-id]:checked')].map(el=>el.dataset.selectId);
 data={...data,sortMode:'manual',recipes:data.recipes.map(r=>({...r,manualOrder:ranks.get(r.id)}))};
 if(!save()){data=previous;return}
 list();for(const el of $('recipe-list').querySelectorAll('[data-select-id]'))el.checked=checked.includes(el.dataset.selectId);
 const handle=[...$('recipe-list').querySelectorAll('[data-drag-id]')].find(el=>el.dataset.dragId===focusId);handle?.focus({preventScroll:true});
 $('recipe-order-status').textContent='카드 순서를 저장했어요.';
}
function moveRecipeStep(id,direction){const ids=visibleRecipeIds(),from=ids.indexOf(id),to=from+direction;if(from<0||to<0||to>=ids.length)return;[ids[from],ids[to]]=[ids[to],ids[from]];saveRecipeOrder(ids,id)}
function installRecipeTools(){
 const toolbar=document.createElement('div');toolbar.className='recipe-sort-toolbar';
 toolbar.innerHTML='<label for="recipe-sort">정렬 방식</label><select id="recipe-sort">'+Object.entries(RECIPE_SORTS).map(([v,label])=>`<option value="${v}">${label}</option>`).join('')+'</select><p id="recipe-sort-help">예전에 등록한 레시피는 날짜 기록이 없어 기존 등록 순서를 기준으로 표시돼요.</p><p id="recipe-order-status" role="status" aria-live="polite"></p>';
 $('recipe-results').before(toolbar);
 const wrap=document.createElement('div');wrap.id='copy-source-wrap';wrap.className='copy-source-wrap';
 wrap.innerHTML='<label for="copy-source">기존 레시피에서 복제 (선택)</label><select id="copy-source"></select><p class="small">내용을 가져온 뒤 수정해서 저장하세요. 원본과 연습 기록은 변경되지 않아요.</p>';
 $('name').previousElementSibling.before(wrap);
 $('copy-source').onchange=()=>{
  const id=$('copy-source').value;if(!confirm('현재 입력 중인 내용을 선택한 레시피로 바꿀까요? 새로 작성하기를 선택했다면 입력 내용이 비워져요.')){$('copy-source').value='';return}
  if(id){const r=data.recipes.find(r=>r.id===id);if(!r)return;fillRecipeFields(r);$('name').value=(r.name+' (복사)').slice(0,100);$('form-title').textContent='레시피 복제'}
  else {fillRecipeFields({temperature:'HOT'});$('form-title').textContent='레시피 추가'}
 };
 $('recipe-sort').onchange=()=>{const previous=data.sortMode;data.sortMode=$('recipe-sort').value;if(!save())data.sortMode=previous;list()};
 $('recipe-list').addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.copyId)openRecipeEditor(null,b.dataset.copyId);if(b?.dataset.moveId)moveRecipeStep(b.dataset.moveId,Number(b.dataset.direction))});
 $('recipe-list').addEventListener('keydown',e=>{const h=e.target.closest('[data-drag-id]');if(h&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();moveRecipeStep(h.dataset.dragId,e.key==='ArrowUp'?-1:1)}});
 let drag=null,frame=0;
 function clearMarks(){for(const el of $('recipe-list').querySelectorAll('.drop-before,.drop-after'))el.classList.remove('drop-before','drop-after')}
 function locate(){clearMarks();const row=document.elementFromPoint(drag.x,drag.y)?.closest('[data-recipe-id]');drag.target=null;if(!row||row.dataset.recipeId===drag.id)return;drag.target=row.dataset.recipeId;drag.after=drag.y>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;row.classList.add(drag.after?'drop-after':'drop-before')}
 function scrollDrag(){if(!drag)return;if(drag.moved){const speed=drag.y<80?-12:drag.y>innerHeight-80?12:0;if(speed){window.scrollBy(0,speed);locate()}}frame=requestAnimationFrame(scrollDrag)}
 function finish(cancel=false){if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(frame);clearMarks();d.row.classList.remove('dragging');document.body.classList.remove('recipe-dragging');if(d.handle.hasPointerCapture?.(d.pointerId))d.handle.releasePointerCapture(d.pointerId);if(cancel||!d.moved||!d.target)return;const ids=visibleRecipeIds().filter(id=>id!==d.id),at=ids.indexOf(d.target);if(at<0)return;ids.splice(at+(d.after?1:0),0,d.id);saveRecipeOrder(ids,d.id)}
 $('recipe-list').addEventListener('pointerdown',e=>{const h=e.target.closest('[data-drag-id]');if(!h||e.button!==0||!e.isPrimary)return;e.preventDefault();drag={id:h.dataset.dragId,handle:h,row:h.closest('[data-recipe-id]'),pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,moved:false};h.setPointerCapture(e.pointerId);frame=requestAnimationFrame(scrollDrag)});
 $('recipe-list').addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;if(Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>6)drag.moved=true;if(drag.moved){drag.row.classList.add('dragging');document.body.classList.add('recipe-dragging');locate()}});
 $('recipe-list').addEventListener('pointerup',()=>finish());$('recipe-list').addEventListener('pointercancel',()=>finish(true));$('recipe-list').addEventListener('lostpointercapture',()=>finish(true));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')finish(true)});window.addEventListener('blur',()=>finish(true));
 list();
}
function syncRecipeSortUI(){if(!$('recipe-sort'))return;$('recipe-sort').value=getRecipeSort();$('recipe-sort-help').textContent=getRecipeSort()==='manual'?'카드의 ⠿ 손잡이를 끌거나 ↑ ↓ 버튼으로 이동하세요. 검색·분류 중에는 보이는 카드끼리 순서가 바뀌어요.':'예전에 등록한 레시피는 날짜 기록이 없어 기존 등록 순서를 기준으로 표시돼요.';const rows=[...$('recipe-list').querySelectorAll('[data-recipe-id]')];rows.forEach((row,i)=>{const up=row.querySelector('[data-direction="-1"]'),down=row.querySelector('[data-direction="1"]');if(up)up.disabled=i===0;if(down)down.disabled=i===rows.length-1})}
document.addEventListener('DOMContentLoaded',installRecipeTools);
