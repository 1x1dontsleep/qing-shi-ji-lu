const KEY='qingshiji-v1';
const iso=d=>d.toISOString().slice(0,10);
const today=iso(new Date());
const PLAN={goal:2034,proteinGoal:132.8,carbGoal:207.5,fatGoal:74.7};
const PLAN_VERSION='tan-v1';
const defaults={age:22,sex:'male',height:168,weight:84,sessions:4.5,hours:5.5,...PLAN};
const base={profile:defaults,meals:{},weights:{[today]:84},savedFoods:[],fitnessInterest:false};
let state=(()=>{try{const stored=JSON.parse(localStorage.getItem(KEY)||'{}');const migrate=stored.planVersion!==PLAN_VERSION;return {...base,...stored,planVersion:PLAN_VERSION,profile:{...defaults,...(stored.profile||{}),...(migrate?{sex:'male',...PLAN}:{})}}}catch{return {...base,planVersion:PLAN_VERSION}}})();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const toast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)};
const fmtDate=d=>new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(d);
const mealEmoji={早餐:'☀️',午餐:'🥗',晚餐:'🌙',加餐:'🍎'};
const display=n=>Number(n).toFixed(Number(n)%1?1:0);
let selectedFood=null,ocrWorker=null,previewUrl=null,ocrRun=0,customEntryMode='ocr';
const FOOD_TERMS={
  '鸡胸肉':'chicken breast roasted','鸡肉':'chicken cooked','米饭':'white rice cooked','糙米':'brown rice cooked','荞麦面':'buckwheat noodles cooked','面条':'noodles cooked','意面':'pasta cooked','燕麦':'oatmeal cooked','面包':'whole wheat bread','鸡蛋':'egg whole cooked','牛肉':'beef cooked','猪肉':'pork cooked','三文鱼':'salmon cooked','金枪鱼':'tuna canned','虾仁':'shrimp cooked','虾':'shrimp cooked','低脂牛奶':'milk low fat','脱脂牛奶':'milk nonfat','牛奶':'milk','希腊酸奶':'greek yogurt plain','酸奶':'yogurt plain','豆浆':'soy milk','豆腐':'tofu firm','香蕉':'banana raw','苹果':'apple raw','橙子':'orange raw','蓝莓':'blueberries raw','西兰花':'broccoli cooked','彩椒':'sweet pepper raw','菌菇':'mushrooms cooked','青菜':'leafy greens cooked','绿叶菜':'leafy greens cooked','土豆':'potato cooked','红薯':'sweet potato cooked','牛油果':'avocado raw','橄榄油':'olive oil','花生酱':'peanut butter','坚果':'mixed nuts','花生':'peanuts roasted','饺子':'dumpling','炒饭':'fried rice','汉堡':'hamburger','披萨':'pizza'
};
const MEAL_PLANS={
  '早餐':[
    {target:'约 510 kcal · 碳水 52g · 蛋白 33g · 脂肪 19g',foods:['燕麦片','低脂牛奶','水煮鸡蛋','香蕉']},
    {target:'约 510 kcal · 碳水 52g · 蛋白 33g · 脂肪 19g',foods:['全麦面包','无糖酸奶','水煮鸡蛋','苹果']}
  ],
  '午餐':[
    {target:'约 710 kcal · 碳水 73g · 蛋白 47g · 脂肪 26g',foods:['米饭','鸡胸肉','西兰花','橄榄油']},
    {target:'约 710 kcal · 碳水 73g · 蛋白 47g · 脂肪 26g',foods:['糙米饭','瘦牛肉','彩椒','菌菇']}
  ],
  '晚餐':[
    {target:'约 610 kcal · 碳水 62g · 蛋白 40g · 脂肪 22g',foods:['红薯','三文鱼','绿叶菜']},
    {target:'约 610 kcal · 碳水 62g · 蛋白 40g · 脂肪 22g',foods:['荞麦面','虾仁','豆腐','青菜']}
  ],
  '加餐':[
    {target:'约 200 kcal · 碳水 21g · 蛋白 13g · 脂肪 8g',foods:['无糖希腊酸奶','蓝莓','坚果']},
    {target:'约 200 kcal · 碳水 21g · 蛋白 13g · 脂肪 8g',foods:['脱脂牛奶','苹果','花生酱']}
  ]
};
const recommendationVariant={早餐:0,午餐:0,晚餐:0,加餐:0};
function render(){
  const meals=state.meals[today]||[];
  const total=key=>meals.reduce((s,m)=>s+Number(m[key]||0),0);
  const kcal=total('kcal'),protein=total('protein'),carbs=total('carbs'),fat=total('fat');
  const goal=Number(state.profile.goal)||PLAN.goal;
  const pct=Math.min(100,Math.round(kcal/goal*100)||0);
  $('#todayLabel').textContent=fmtDate(new Date());
  $('#consumedKcal').textContent=kcal;
  $('#goalKcal').textContent=goal;
  $('#remainingText').textContent=kcal<=goal?`还可以摄入 ${goal-kcal} kcal`:`已超过目标 ${kcal-goal} kcal，偶尔一天没关系`;
  $('#calorieRing').style.setProperty('--progress',pct);
  $('#ringPercent').textContent=pct+'%';
  [['protein',protein],['carb',carbs],['fat',fat]].forEach(([key,value])=>{
    const goalValue=state.profile[key+'Goal'];
    $('#'+key+'Total').textContent=display(value);
    $('#'+key+'Goal').textContent=goalValue;
    $('#'+key+'Bar').style.width=Math.min(100,value/goalValue*100)+'%';
  });
  $('#sessionsValue').textContent=state.profile.sessions;
  $('#weightValue').textContent=state.profile.weight;
  $('#bmiValue').textContent='BMI '+(state.profile.weight/((state.profile.height/100)**2)).toFixed(1);
  $('#weightInput').value=state.profile.weight;
  $('#mealList').innerHTML=meals.map((m,i)=>`<article class="meal-item"><span class="meal-emoji">${mealEmoji[m.type]||'🍽️'}</span><div class="meal-main"><h3>${escapeHtml(m.name)}</h3><p>${m.type}${m.protein?` · 蛋白 ${m.protein}g`:''}${m.carbs?` · 碳水 ${m.carbs}g`:''}${m.fat?` · 脂肪 ${m.fat}g`:''}</p></div><span class="meal-kcal">${m.kcal}<small> kcal</small></span><button class="delete" data-delete="${i}" aria-label="删除">×</button></article>`).join('');
  $('#emptyMeals').hidden=meals.length>0;
  renderChart();
  renderRecommendations();
}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function renderChart(){
  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=iso(d);const total=(state.meals[key]||[]).reduce((s,m)=>s+Number(m.kcal),0);return {key,label:i===6?'今天':new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(d),total}});
  const max=Math.max(state.profile.goal,...days.map(d=>d.total));
  const active=days.filter(d=>d.total>0);
  $('#weekAverage').textContent=(active.length?Math.round(active.reduce((s,d)=>s+d.total,0)/active.length):0)+' kcal';
  $('#calorieChart').innerHTML=days.map(d=>`<div class="bar-wrap" title="${d.total} kcal"><div class="bar ${d.key===today?'today':''}" style="height:${Math.max(3,d.total/max*100)}%"></div><small>${d.label}</small></div>`).join('');
}
function resetPhotoOcr(){
  ocrRun+=1;
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}
  $('#nutritionPreview').removeAttribute('src');$('#nutritionPreview').hidden=true;$('#ocrStatus').hidden=true;$('#ocrStatus').textContent='';$('#ocrEditor').hidden=true;
  ['#ocrBasis','#ocrKcal','#ocrProtein','#ocrCarbs','#ocrFat'].forEach(id=>$(id).value='');
}
function renderSavedFoods(){
  const foods=state.savedFoods||[];$('#savedFoodSection').hidden=!foods.length;
  $('#savedFoodList').innerHTML=foods.map((food,index)=>`<div class="saved-food-row"><button type="button" class="saved-food-pick" data-saved-index="${index}"><strong>${escapeHtml(food.name)}</strong><span>每 100g · ${Math.round(food.kcal)} kcal · 蛋白 ${display(food.protein)}g</span></button><button type="button" class="saved-food-delete" data-saved-delete="${index}" aria-label="删除 ${escapeHtml(food.name)}">×</button></div>`).join('');
}
function rememberFood(name,amount){
  if(!selectedFood?.remember)return;
  const entry={name,kcal:selectedFood.kcal,protein:selectedFood.protein,carbs:selectedFood.carbs,fat:selectedFood.fat,defaultAmount:amount,source:selectedFood.source,savedAt:Date.now()};
  const key=name.trim().toLocaleLowerCase();const foods=state.savedFoods||[];const existing=foods.findIndex(food=>food.name.trim().toLocaleLowerCase()===key);
  if(existing>=0)foods.splice(existing,1);foods.unshift(entry);state.savedFoods=foods.slice(0,50);
}
function resetFoodSearch(){selectedFood=null;customEntryMode='ocr';$('#foodResults').innerHTML='';$('#foodResults').removeAttribute('data-foods');$('#searchStatus').hidden=true;$('#selectedFood').hidden=true;$('#amountLabel').hidden=true;$('#saveFood').disabled=true;$('#foodAmount').value=100;resetPhotoOcr()}
function openFood(meal,name){$('#foodForm').reset();resetFoodSearch();renderSavedFoods();if(meal)$('#mealType').value=meal;if(name)$('#foodName').value=name;$('#foodDialog').showModal();setTimeout(()=>name?searchFood():$('#foodName').focus(),100)}
function nutrient(food,name,unit){const n=(food.foodNutrients||[]).find(x=>x.nutrientName===name&&(!unit||String(x.unitName).toUpperCase()===unit));return n?Number(n.value??n.amount):null}
function normalizeFood(food){
  const kcal=nutrient(food,'Energy','KCAL'),protein=nutrient(food,'Protein'),carbs=nutrient(food,'Carbohydrate, by difference'),fat=nutrient(food,'Total lipid (fat)');
  if(kcal===null||[kcal,protein,carbs,fat].some(v=>v===null||Number.isNaN(v)))return null;
  return {fdcId:food.fdcId,description:food.description||'未命名食物',dataType:food.dataType||'',kcal,protein,carbs,fat};
}
function cleanOcrText(text){
  const full='０１２３４５６７８９．，：％';const half='0123456789.,:%';
  return String(text||'').replace(/[０-９．，：％]/g,char=>half[full.indexOf(char)]).replace(/\r/g,'');
}
function numericValue(raw){const match=String(raw||'').match(/\d+(?:[.,]\d+)?/);return match?Number(match[0].replace(',','.')):null}
function valueAfterLabel(lines,patterns){
  for(const line of lines){for(const pattern of patterns){const match=line.match(pattern);if(!match)continue;const value=numericValue(line.slice((match.index||0)+match[0].length));if(value!==null)return value}}
  return null;
}
function parseNutritionText(raw){
  const text=cleanOcrText(raw),lines=text.split('\n').map(line=>line.trim()).filter(Boolean);
  let kcal=null;
  for(const line of lines){
    if(!/(能量|热量|energy|calories?)/i.test(line))continue;
    const kcalMatch=line.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|千卡|大卡)/i);
    if(kcalMatch){kcal=Number(kcalMatch[1].replace(',','.'));break}
    const kjMatch=line.match(/(\d+(?:[.,]\d+)?)\s*(?:kj|千焦)/i);
    if(kjMatch){kcal=Number(kjMatch[1].replace(',','.'))/4.184;break}
    const calorieValue=valueAfterLabel([line],[/calories?/i]);if(calorieValue!==null){kcal=calorieValue;break}
  }
  const protein=valueAfterLabel(lines,[/蛋白质/,/protein/i]);
  const carbs=valueAfterLabel(lines,[/碳水化合物/,/碳水/,/total\s+carbohydrate/i,/carbohydrates?/i]);
  const fat=valueAfterLabel(lines,[/总脂肪/,/脂肪/,/total\s+fat/i,/\bfat\b/i]);
  let basis=100;
  if(!/(每\s*100\s*(?:克|g)|per\s*100\s*g)/i.test(text)){
    const serving=text.match(/(?:每份|份量|serving\s*size)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(?:克|g)/i);
    if(serving)basis=Number(serving[1].replace(',','.'));
  }
  return {basis,kcal:kcal===null?null:Math.round(kcal*10)/10,protein,carbs,fat};
}
async function getOcrWorker(){
  if(ocrWorker)return ocrWorker;
  if(!window.Tesseract)throw new Error('OCR library unavailable');
  ocrWorker=await Tesseract.createWorker(['chi_sim','eng'],1,{logger:message=>{
    if(message.status!=='recognizing text'||$('#foodDialog').open===false)return;
    $('#ocrStatus').textContent=`正在识别文字… ${Math.round((message.progress||0)*100)}%`;
  }});
  return ocrWorker;
}
async function recognizeNutritionPhoto(file){
  if(!file)return;
  $('#nutritionPhoto').value='';
  resetPhotoOcr();customEntryMode='ocr';$('#ocrEditorHint').textContent='请核对识别结果，标签排版不同可能造成误差。';$('#useOcrResult').textContent='使用识别结果';const run=ocrRun;
  previewUrl=URL.createObjectURL(file);$('#nutritionPreview').src=previewUrl;$('#nutritionPreview').hidden=false;
  $('#ocrStatus').hidden=false;$('#ocrStatus').textContent='正在加载中英文识别模型，首次使用可能需要一点时间…';
  try{
    const worker=await getOcrWorker();const result=await worker.recognize(file,{rotateAuto:true});if(run!==ocrRun)return;
    const nutrition=parseNutritionText(result.data.text),fields={ocrBasis:nutrition.basis,ocrKcal:nutrition.kcal,ocrProtein:nutrition.protein,ocrCarbs:nutrition.carbs,ocrFat:nutrition.fat};
    Object.entries(fields).forEach(([id,value])=>$('#'+id).value=value??'');
    const found=[nutrition.kcal,nutrition.protein,nutrition.carbs,nutrition.fat].filter(value=>value!==null).length;
    $('#ocrStatus').textContent=found===4?'已识别 4 项营养数据，请核对后使用。':`识别到 ${found}/4 项，请对照包装补全或修正。`;
    $('#ocrEditor').hidden=false;
  }catch(error){if(run!==ocrRun)return;$('#ocrStatus').textContent='识别没有完成，请换一张光线更好、文字更清晰的照片再试。';console.warn('Nutrition OCR failed',error)}
}
function translatedQuery(raw){const match=Object.keys(FOOD_TERMS).find(key=>raw.includes(key));return match?FOOD_TERMS[match]:raw}
function resultLabel(food,index){
  const d=food.description.toLowerCase();let style='常见食物';
  if(d.includes('breaded'))style='裹粉';else if(d.includes('fried'))style='油炸';else if(d.includes('roast')||d.includes('baked'))style='烤制';else if(d.includes('boiled'))style='水煮';else if(d.includes('canned'))style='罐装';else if(d.includes('raw'))style='生鲜';else if(d.includes('cooked'))style='熟制';else if(food.dataType==='Branded')style='包装食品';
  return `${$('#foodName').value.trim()} · ${style} ${index+1}`;
}
async function searchFood(){
  const raw=$('#foodName').value.trim();if(!raw)return toast('先输入食物名称');
  const status=$('#searchStatus'),button=$('#searchFood');button.disabled=true;status.hidden=false;status.textContent='正在联网查询营养数据库…';$('#foodResults').innerHTML='';selectedFood=null;$('#saveFood').disabled=true;$('#selectedFood').hidden=true;$('#amountLabel').hidden=true;
  try{
    const query=translatedQuery(raw);const url=`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(query)}&pageSize=15`;
    const response=await fetch(url);if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();const rank={'Foundation':0,'SR Legacy':1,'Survey (FNDDS)':2,'Branded':3};
    const foods=(data.foods||[]).map(normalizeFood).filter(Boolean).sort((a,b)=>(rank[a.dataType]??9)-(rank[b.dataType]??9)).slice(0,6);
    if(!foods.length){status.textContent='没有找到可用数据，请换一个更通用的名称或尝试英文名称。';return}
    status.textContent=`找到 ${foods.length} 个结果，选择最接近的一项（以下均为每 100 克）`;
    $('#foodResults').innerHTML=foods.map((f,i)=>`<button type="button" class="food-result" data-food-index="${i}"><strong>${escapeHtml(resultLabel(f,i))}</strong><span>${Math.round(f.kcal)} kcal · 蛋白 ${display(f.protein)}g · 碳水 ${display(f.carbs)}g · 脂肪 ${display(f.fat)}g</span><span>每 100 克 · 联网营养数据</span></button>`).join('');
    $('#foodResults').dataset.foods=JSON.stringify(foods);
  }catch(error){status.textContent='暂时无法连接营养数据库，请稍后再试。';console.warn('Food search failed',error)}finally{button.disabled=false}
}
function updateSelectedFood(){
  if(!selectedFood)return;const amount=Number($('#foodAmount').value)||100,ratio=amount/100;
  $('#selectedFood').innerHTML=`<h3>${escapeHtml($('#foodName').value.trim())}</h3><p>${amount}g：${Math.round(selectedFood.kcal*ratio)} kcal · 蛋白 ${display(selectedFood.protein*ratio)}g · 碳水 ${display(selectedFood.carbs*ratio)}g · 脂肪 ${display(selectedFood.fat*ratio)}g</p><p>数据来源：${escapeHtml(selectedFood.source||'美国农业部 FoodData Central')}</p>`;
}
function renderRecommendations(){
  $('#mealRecommendations').innerHTML=Object.entries(MEAL_PLANS).map(([meal,plans])=>{const plan=plans[recommendationVariant[meal]];return `<article class="recommendation-card"><div class="recommendation-top"><div><h3>${meal}</h3><p>${plan.target}</p></div><button type="button" class="swap-plan" data-swap-meal="${meal}">换一组</button></div><div class="food-chips">${plan.foods.map(food=>`<button type="button" class="food-chip" data-recommend-meal="${meal}" data-recommend-food="${escapeHtml(food)}">${escapeHtml(food)}</button>`).join('')}</div></article>`}).join('');
}
function fillProfile(){
  const p=state.profile;
  $('#ageInput').value=p.age;$('#sexInput').value=p.sex;$('#heightInput').value=p.height;$('#profileWeight').value=p.weight;$('#sessionsInput').value=p.sessions;$('#hoursInput').value=p.hours;$('#goalInput').value=p.goal;$('#proteinGoalInput').value=p.proteinGoal;$('#carbGoalInput').value=p.carbGoal;$('#fatGoalInput').value=p.fatGoal;$('#suggestedGoal').textContent=PLAN.goal;
}
function formProfile(){return {age:Number($('#ageInput').value),sex:$('#sexInput').value,height:Number($('#heightInput').value),weight:Number($('#profileWeight').value),sessions:Number($('#sessionsInput').value),hours:Number($('#hoursInput').value),goal:Number($('#goalInput').value),proteinGoal:Number($('#proteinGoalInput').value),carbGoal:Number($('#carbGoalInput').value),fatGoal:Number($('#fatGoalInput').value)}}
function openProfile(){fillProfile();$('#profileDialog').showModal()}

['#addFoodTop','#addFirstFood'].forEach(id=>$(id).addEventListener('click',()=>openFood()));
$('#searchFood').addEventListener('click',searchFood);
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('#foodDialog').addEventListener('close',()=>{$('#foodForm').reset();resetFoodSearch()});
$('#nutritionPhoto').addEventListener('change',e=>recognizeNutritionPhoto(e.target.files[0]));
$('#openCustomFood').addEventListener('click',()=>{resetPhotoOcr();customEntryMode='custom';$('#ocrBasis').value=100;$('#ocrStatus').hidden=false;$('#ocrStatus').textContent='填写食物包装或配方中的营养数据，保存后会加入常用食物。';$('#ocrEditorHint').textContent='请填写以下 5 项；建议统一填写每 100 克的数据。';$('#useOcrResult').textContent='使用自定义数据';$('#ocrEditor').hidden=false;$('#foodName').focus()});
$('#useOcrResult').addEventListener('click',()=>{
  const raw=['#ocrBasis','#ocrKcal','#ocrProtein','#ocrCarbs','#ocrFat'].map(id=>$(id).value.trim()),[basis,kcal,protein,carbs,fat]=raw.map(Number);
  if(raw.some(value=>value==='')||!basis||basis<=0||[kcal,protein,carbs,fat].some(value=>!Number.isFinite(value)||value<0))return toast('请补全并检查 5 项识别数据');
  if(!$('#foodName').value.trim())$('#foodName').value=customEntryMode==='custom'?'自定义食物':'拍照识别食品';
  const factor=100/basis,source=customEntryMode==='custom'?'自定义营养数据':'本机拍照识别（已由你核对）';selectedFood={description:customEntryMode==='custom'?'自定义食物':'包装营养成分表',source,remember:true,kcal:kcal*factor,protein:protein*factor,carbs:carbs*factor,fat:fat*factor};
  $('#foodAmount').value=basis;$('#foodResults').innerHTML='';$('#searchStatus').hidden=true;$('#selectedFood').hidden=false;$('#amountLabel').hidden=false;$('#saveFood').disabled=false;updateSelectedFood();toast(customEntryMode==='custom'?'已使用自定义数据':'已使用识别结果');
});
$('#savedFoodList').addEventListener('click',e=>{const remove=e.target.closest('[data-saved-delete]');if(remove){state.savedFoods.splice(Number(remove.dataset.savedDelete),1);save();renderSavedFoods();toast('已从常用食物移除');return}const button=e.target.closest('[data-saved-index]');if(!button)return;const food=state.savedFoods[Number(button.dataset.savedIndex)];if(!food)return;resetPhotoOcr();$('#foodName').value=food.name;selectedFood={...food,description:'我的常用食物',source:'我的食物库',remember:true};$('#foodAmount').value=food.defaultAmount||100;$('#foodResults').innerHTML='';$('#searchStatus').hidden=true;$('#selectedFood').hidden=false;$('#amountLabel').hidden=false;$('#saveFood').disabled=false;updateSelectedFood()});
$('#foodName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchFood()}});
$('#foodResults').addEventListener('click',e=>{const button=e.target.closest('[data-food-index]');if(!button)return;const foods=JSON.parse($('#foodResults').dataset.foods||'[]');selectedFood=foods[Number(button.dataset.foodIndex)];if(!selectedFood)return;$('#foodResults').innerHTML='';$('#searchStatus').hidden=true;$('#selectedFood').hidden=false;$('#amountLabel').hidden=false;$('#saveFood').disabled=false;updateSelectedFood()});
$('#foodAmount').addEventListener('input',updateSelectedFood);
$('#foodForm').addEventListener('submit',e=>{e.preventDefault();if(!selectedFood)return searchFood();const amount=Number($('#foodAmount').value)||100,ratio=amount/100,one=n=>Math.round(n*10)/10,name=$('#foodName').value.trim(),remembered=Boolean(selectedFood.remember);const item={type:$('#mealType').value,name,amount,sourceName:selectedFood.description,source:selectedFood.source||'USDA FoodData Central',kcal:Math.round(selectedFood.kcal*ratio),protein:one(selectedFood.protein*ratio),carbs:one(selectedFood.carbs*ratio),fat:one(selectedFood.fat*ratio)};(state.meals[today] ||= []).push(item);rememberFood(name,amount);save();$('#foodDialog').close();render();toast(remembered?'已记录并保存到常用食物':'营养数据已自动记录')});
$('#mealRecommendations').addEventListener('click',e=>{const swap=e.target.closest('[data-swap-meal]');if(swap){const meal=swap.dataset.swapMeal;recommendationVariant[meal]=(recommendationVariant[meal]+1)%MEAL_PLANS[meal].length;renderRecommendations();return}const food=e.target.closest('[data-recommend-food]');if(food)openFood(food.dataset.recommendMeal,food.dataset.recommendFood)});
$('#mealList').addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;state.meals[today].splice(Number(b.dataset.delete),1);save();render();toast('已删除这条记录')});
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>{$$('.nav-item').forEach(x=>x.classList.toggle('active',x===b));$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===b.dataset.target));scrollTo({top:0,behavior:'smooth'})}));
$('#openProfile').addEventListener('click',openProfile);$('#editTargets').addEventListener('click',openProfile);
$('#recalculate').addEventListener('click',()=>{$('#sexInput').value='male';$('#goalInput').value=PLAN.goal;$('#proteinGoalInput').value=PLAN.proteinGoal;$('#carbGoalInput').value=PLAN.carbGoal;$('#fatGoalInput').value=PLAN.fatGoal;$('#suggestedGoal').textContent=PLAN.goal;toast('已恢复计划目标')});
$('#profileForm').addEventListener('submit',e=>{e.preventDefault();state.profile=formProfile();state.weights[today]=state.profile.weight;save();$('#profileDialog').close();render();toast('个人目标已更新')});
$('#saveWeight').addEventListener('click',()=>{const w=Number($('#weightInput').value);if(!w||w<30||w>300)return toast('请输入有效体重');state.profile.weight=w;state.weights[today]=w;save();render();toast('今天的体重已保存')});
$('#fitnessInterest').addEventListener('click',()=>{state.fitnessInterest=true;save();$('#fitnessInterest').textContent='已记录你的期待 ✓';$('#fitnessInterest').disabled=true;toast('下一步会优先考虑健身模块')});
if(state.fitnessInterest){$('#fitnessInterest').textContent='已记录你的期待 ✓';$('#fitnessInterest').disabled=true}
save();render();
