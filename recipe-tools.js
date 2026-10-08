'use strict';
const RECIPE_SORTS={newest:'최근 등록순',oldest:'오래된 등록순',updated:'최근 수정순',name:'가나다순'};
const RECIPE_FIELDS=['name','size','temperature','ingredients','steps','first','note','shots','syrup','additives'];
function recipeTime(value){return Number.isSafeInteger(value)&&value>0&&value<=8640000000000000?value:0}
function recipeMetadata(r,i){return {...r,createdAt:recipeTime(r.createdAt),updatedAt:recipeTime(r.updatedAt)||recipeTime(r.createdAt),manualOrder:Number.isSafeInteger(r.manualOrder)&&r.manualOrder>=0?r.manualOrder:i}}
function getRecipeSort(){return Object.hasOwn(RECIPE_SORTS,data.sortMode)?data.sortMode:'newest'}
function sortRecipes(recipes,mode=getRecipeSort()){
 if(arguments.length<2&&data.customOrder)mode='manual';
 const positions=new Map(data.recipes.map((r,i)=>[r.id,i]));
 const position=r=>positions.get(r.id)??0;
 const created=(a,b)=>recipeTime(a.createdAt)-recipeTime(b.createdAt)||position(a)-position(b);
 return [...recipes].sort((a,b)=>mode==='oldest'?created(a,b):mode==='updated'?(recipeTime(b.updatedAt)-recipeTime(a.updatedAt)||-created(a,b)):mode==='name'?(a.name.localeCompare(b.name,'ko',{numeric:true,sensitivity:'base'})||created(a,b)):mode==='manual'?((a.manualOrder??position(a))-(b.manualOrder??position(b))||created(a,b)):-created(a,b));
}
function recipeMoveControls(){return ''}
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
 const all=sortRecipes(data.recipes),visible=new Set(ids);let n=0;
 // Only replace the visible slots. Hidden recipes keep their relative positions.
 const byId=new Map(data.recipes.map(r=>[r.id,r]));
 const order=all.map(r=>visible.has(r.id)?byId.get(ids[n++]):r);
 const ranks=new Map(order.map((r,i)=>[r.id,i]));
 const previous=data,checked=[...$('recipe-list').querySelectorAll('[data-select-id]:checked')].map(el=>el.dataset.selectId);
 data={...data,sortMode:getRecipeSort(),customOrder:true,recipes:data.recipes.map(r=>({...r,manualOrder:ranks.get(r.id)}))};
 if(!save()){data=previous;return}
 list();for(const el of $('recipe-list').querySelectorAll('[data-select-id]'))el.checked=checked.includes(el.dataset.selectId);
 const card=[...$('recipe-list').querySelectorAll('[data-recipe-id]')].find(el=>el.dataset.recipeId===focusId);card?.focus({preventScroll:true});
 $('recipe-order-status').textContent='카드 순서를 저장했어요.';
}
function moveRecipeStep(id,direction){const ids=visibleRecipeIds(),from=ids.indexOf(id),to=from+direction;if(from<0||to<0||to>=ids.length)return;[ids[from],ids[to]]=[ids[to],ids[from]];saveRecipeOrder(ids,id)}
function installRecipeTools(){
 const toolbar=document.createElement('div');toolbar.className='recipe-sort-toolbar';
 toolbar.innerHTML='<select id="recipe-sort" aria-label="정렬 방식"><option value="" disabled>정렬 방식</option>'+Object.entries(RECIPE_SORTS).map(([v,label])=>`<option value="${v}">${label}</option>`).join('')+'</select><button type="button" id="recipe-sort-info" aria-label="정렬 방식 설명" aria-haspopup="dialog">i</button>';
 const actions=document.createElement('div');actions.className='recipe-actions-bar';$('bulk-actions').before(actions);actions.append(toolbar,$('bulk-actions'));
 const status=document.createElement('p');status.id='recipe-order-status';status.className='sr-only';status.setAttribute('role','status');status.setAttribute('aria-live','polite');actions.after(status);
 const help=document.createElement('dialog');help.id='recipe-sort-dialog';help.setAttribute('aria-labelledby','recipe-sort-title');
 help.innerHTML='<h2 id="recipe-sort-title">정렬 방식 안내</h2><dl><dt>최근 등록순</dt><dd>나중에 등록한 레시피부터 보여요.</dd><dt>오래된 등록순</dt><dd>먼저 등록한 레시피부터 보여요.</dd><dt>최근 수정순</dt><dd>최근에 저장하거나 수정한 레시피부터 보여요.</dd><dt>가나다순</dt><dd>음료 이름 순서로 보여요.</dd></dl><p>어떤 정렬 상태에서도 카드의 이름이나 빈 부분을 약 0.5초간 길게 누른 뒤 위아래로 끌어 놓을 수 있어요. 버튼과 체크박스에서는 이동이 시작되지 않아요.</p><p>옮긴 순서는 자동으로 저장돼요. 정렬 메뉴를 다시 선택하면 해당 기준으로 재정렬돼요. 검색·분류 중에는 보이는 카드끼리만 순서가 바뀌어요.</p><p>키보드: 카드에 초점을 맞추고 Alt + ↑ 또는 ↓를 누르세요.</p><p>예전 레시피에는 날짜 기록이 없어 기존 등록 순서를 기준으로 표시돼요.</p><button type="button" class="secondary" id="recipe-sort-close">닫기</button>';document.body.append(help);
 $('recipe-sort-info').onclick=()=>help.showModal();$('recipe-sort-close').onclick=()=>help.close();
 $('recipe-sort').onchange=()=>{const previous=data;data={...data,sortMode:$('recipe-sort').value,customOrder:false};if(!save())data=previous;list()};
 $('recipe-list').addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.copyId)openRecipeEditor(null,b.dataset.copyId);if(b?.dataset.moveId)moveRecipeStep(b.dataset.moveId,Number(b.dataset.direction))});
 $('recipe-list').addEventListener('keydown',e=>{const row=e.target.closest('[data-recipe-id]');if(row&&e.target===row&&e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();moveRecipeStep(row.dataset.recipeId,e.key==='ArrowUp'?-1:1)}});
 let drag=null,frame=0,hold=0,suppressClickUntil=0;
 const container=$('recipe-list');
 function clearMarks(){for(const el of container.querySelectorAll('.drop-before,.drop-after'))el.classList.remove('drop-before','drop-after')}
 function locate(){clearMarks();const row=document.elementFromPoint(drag.x,drag.y)?.closest('[data-recipe-id]');drag.target=null;if(!row||row.dataset.recipeId===drag.id)return;drag.target=row.dataset.recipeId;drag.after=drag.y>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;row.classList.add(drag.after?'drop-after':'drop-before')}
 function scrollDrag(){if(!drag?.active)return;const speed=drag.y<80?-12:drag.y>innerHeight-80?12:0;if(speed){window.scrollBy(0,speed);locate()}frame=requestAnimationFrame(scrollDrag)}
 function finish(cancel=false){clearTimeout(hold);if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(frame);clearMarks();d.row.classList.remove('dragging');document.body.classList.remove('recipe-dragging');if(d.active)suppressClickUntil=Date.now()+500;if(d.pointerId!==undefined&&d.row.hasPointerCapture?.(d.pointerId))d.row.releasePointerCapture(d.pointerId);if(cancel||!d.active||!d.target)return;const ids=visibleRecipeIds().filter(id=>id!==d.id),at=ids.indexOf(d.target);if(at<0)return;ids.splice(at+(d.after?1:0),0,d.id);saveRecipeOrder(ids,d.id)}
 function begin(target,x,y,pointerId,touchId){if(drag)finish(true);const row=target.closest('[data-recipe-id]');if(!row||target.closest('button,input,select,textarea,a,label'))return;drag={id:row.dataset.recipeId,row,pointerId,touchId,startX:x,startY:y,x,y,active:false};hold=setTimeout(()=>{if(!drag)return;drag.active=true;drag.row.classList.add('dragging');document.body.classList.add('recipe-dragging');if(drag.pointerId!==undefined)drag.row.setPointerCapture(drag.pointerId);$('recipe-order-status').textContent='카드를 잡았어요. 원하는 위치로 이동한 뒤 놓으세요.';frame=requestAnimationFrame(scrollDrag)},450)}
 function move(x,y){if(!drag)return;drag.x=x;drag.y=y;if(!drag.active){if(Math.hypot(x-drag.startX,y-drag.startY)>10)finish(true);return}locate()}
 container.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.button===0&&e.isPrimary)begin(e.target,e.clientX,e.clientY,e.pointerId)});
 container.addEventListener('pointermove',e=>{if(drag&&drag.pointerId===e.pointerId)move(e.clientX,e.clientY)});
 container.addEventListener('pointerup',e=>{if(drag&&drag.pointerId===e.pointerId)finish()});
 container.addEventListener('pointercancel',e=>{if(drag&&drag.pointerId===e.pointerId)finish(true)});
 container.addEventListener('lostpointercapture',e=>{if(drag&&drag.pointerId===e.pointerId)finish(true)});
 // Touch events keep ordinary scrolling available until a stationary long press.
 container.addEventListener('touchstart',e=>{if(e.touches.length!==1){finish(true);return}const t=e.touches[0];begin(e.target,t.clientX,t.clientY,undefined,t.identifier)},{passive:true});
 container.addEventListener('touchmove',e=>{if(!drag||drag.touchId===undefined)return;const t=[...e.touches].find(t=>t.identifier===drag.touchId);if(!t)return;if(drag.active)e.preventDefault();move(t.clientX,t.clientY)},{passive:false});
 container.addEventListener('touchend',e=>{if(drag&&[...e.changedTouches].some(t=>t.identifier===drag.touchId)){if(drag.active)e.preventDefault();finish()}},{passive:false});
 container.addEventListener('touchcancel',()=>finish(true));
 container.addEventListener('contextmenu',e=>{if(e.target.closest('[data-recipe-id]')&&!e.target.closest('button,input,a'))e.preventDefault()});
 container.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('pointerup',e=>{if(drag?.pointerId===e.pointerId)finish()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')finish(true)});window.addEventListener('blur',()=>finish(true));

 list();
}
function syncRecipeSortUI(){if(!$('recipe-sort'))return;$('recipe-sort').value=data.customOrder?'':getRecipeSort();for(const row of $('recipe-list').querySelectorAll('[data-recipe-id]')){row.tabIndex=0;row.setAttribute('aria-label',row.querySelector('h3').textContent+' · 길게 눌러 순서 이동');row.title='길게 눌러 이동 · Alt + ↑/↓로 이동'}}
document.addEventListener('DOMContentLoaded',installRecipeTools);
