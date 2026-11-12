(()=>{"use strict";
const $=id=>document.getElementById(id),DB="pureun-fashion-v3",STORE="records",PROFILE="profile",KEY="pureun-fashion-v3-key",PREF="pureun-fashion-v3-preferences";
const BASE="https://generativelanguage.googleapis.com/v1beta/models/";
const TEXT_MODELS=["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-2.5-flash-lite"];
const PRICES={"gemini-3.1-flash-lite-image":0.0336,"gemini-3.1-flash-image":0.067,"gemini-3-pro-image":0.134};
const state={portrait:"",face:"",key:"",outfits:[],demo:true,fit:"",subject:"",bg:"",color:"#ffffff",selected:0,recordId:null,model:TEXT_MODELS[0],busy:false,install:null,db:null,usage:null,cost:0};
function notify(t){const n=$("notice");n.textContent=t;n.style.display="block";clearTimeout(notify.t);notify.t=setTimeout(()=>n.style.display="none",3100)}
function msg(id,t,err=false){const e=$(id);e.textContent=t;e.style.color=err?"#b33a3a":"#285c92"}
function busy(on){state.busy=on;$("recommend").disabled=on;$("testKey").disabled=on}
function option(){return {season:$("season").value,style:$("style").value,occasion:$("occasion").value,weather:$("weather").value}}
function setOptions(o){if(!o)return;["season","style","occasion","weather"].forEach(x=>{if(o[x]&&[...$(x).options].some(z=>z.value===o[x]))$(x).value=o[x]})}
function safeLS(k){try{return localStorage.getItem(k)}catch(e){return null}}
function openSettings(){$("apiKey").value=state.key;$("settingsOverlay").classList.add("open");}
function closeSettings(){$("settingsOverlay").classList.remove("open")}
$("settingsBtn").onclick=openSettings;$("closeSettings").onclick=closeSettings;
$("settingsOverlay").onclick=e=>{if(e.target===$("settingsOverlay"))closeSettings()};
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSettings()});
try{const pre=JSON.parse(safeLS(PREF)||"{}");if(pre.model)$("imageModel").value=pre.model;if(pre.fx)$("fx").value=pre.fx}catch(e){}
const saved=safeLS(KEY);if(saved){state.key=saved;$("rememberKey").checked=true;msg("apiStatus","기기에 저장된 키를 불러왔습니다. 연결 테스트를 눌러 확인하세요.")}
$("saveKey").onclick=()=>{const k=$("apiKey").value.trim();if(!k){msg("apiStatus","키를 먼저 입력하세요.",true);return}state.key=k;
try{if($("rememberKey").checked)localStorage.setItem(KEY,k);else localStorage.removeItem(KEY);
msg("apiStatus",$("rememberKey").checked?"이 기기에 저장했습니다. 이제 연결 테스트를 누르세요.":"현재 실행 중인 앱에만 저장했습니다. 새로 열면 다시 입력해야 합니다.")}
catch(e){msg("apiStatus","기기 저장이 차단되어 현재 실행 중에만 사용할 수 있습니다.",true)}};
$("clearKey").onclick=()=>{state.key="";$("apiKey").value="";$("rememberKey").checked=false;try{localStorage.removeItem(KEY)}catch(e){}msg("apiStatus","키를 지웠습니다.")};
function savePrefs(){try{localStorage.setItem(PREF,JSON.stringify({model:$("imageModel").value,fx:Number($("fx").value)||1450}))}catch(e){}}
$("imageModel").onchange=savePrefs;$("fx").onchange=savePrefs;
function explain(e){if(e.name==="AbortError")return"요청 시간이 초과됐습니다.";if(e.code===404)return"404: 요청 모델을 사용할 수 없거나 모델명이 변경됐습니다. "+e.message;if(e.code===429)return"429: 사용량 한도 초과. "+e.message;if(e.code===403||e.code===401)return"인증 또는 권한 오류. "+e.message;if(e.code===400)return"요청 형식 오류. "+e.message;return e.message||"알 수 없는 오류"}
async function request(model,payload,timeout=55000){if(!state.key)throw Error("설정에서 Gemini API 키를 입력하고 저장하세요.");
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
try{const r=await fetch(BASE+encodeURIComponent(model)+":generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":state.key},body:JSON.stringify(payload),signal:ctrl.signal});
const out=await r.json().catch(()=>({}));if(!r.ok){const er=Error((out.error?.message||"API 응답 오류").slice(0,350));er.code=r.status;throw er;}return out}
finally{clearTimeout(timer)}}
function partsText(json){return (json.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("")}
async function textRequest(payload,timeout=55000){let last;
for(const candidate of [state.model,...TEXT_MODELS.filter(m=>m!==state.model)]){
try{const out=await request(candidate,payload,timeout);state.model=candidate;return out}catch(e){last=e;if(e.code!==404)throw e}}
throw last||Error("사용 가능한 모델이 없습니다.")}
$("testKey").onclick=async()=>{if(!$("apiKey").value.trim()||$("apiKey").value.trim()!==state.key){msg("apiStatus","키를 입력한 뒤 '저장하기'를 먼저 누르세요.",true);return}
busy(true);msg("apiStatus","Gemini 연결 테스트 중...");
try{const out=await textRequest({contents:[{role:"user",parts:[{text:"연결 확인. 한국어로 '확인' 한 단어만 답하세요."}]}],generationConfig:{maxOutputTokens:180,temperature:0}},32000);
if(!partsText(out).trim())throw Error("응답이 비어 있습니다.");msg("apiStatus","✅ 연결 성공 · "+state.model+" · 실제 API 요청 1회 완료")}
catch(e){msg("apiStatus","❌ 연결 실패 · "+explain(e),true)}finally{busy(false)}};
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbAction(mode,callback){if(!state.db)return null;return new Promise((resolve,reject)=>{const tx=state.db.transaction(STORE,mode),os=tx.objectStore(STORE);let req;try{req=callback(os)}catch(e){reject(e);return}if(req){req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}else{tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error)}})}
async function put(record){if(!state.db)throw Error("이 브라우저에서는 기록 저장소를 사용할 수 없습니다.");await dbAction("readwrite",s=>s.put(record));}
async function all(){return await dbAction("readonly",s=>s.getAll())||[]}
async function one(id){return await dbAction("readonly",s=>s.get(id))}
async function remove(id){await dbAction("readwrite",s=>s.delete(id))}
const uid=()=>Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
async function saveProfile(){try{await put({id:PROFILE,portrait:state.portrait,face:state.face,updatedAt:Date.now()})}catch(e){msg("photoStatus","사진을 메모리에만 유지합니다. 저장소 용량을 확인하세요.",true)}}
function showPhotos(){$("portraitPreview").hidden=!state.portrait;$("portraitHint").hidden=!!state.portrait;if(state.portrait)$("portraitPreview").src=state.portrait;$("facePreview").hidden=!state.face;$("faceHint").hidden=!!state.face;if(state.face)$("facePreview").src=state.face}
const dataURL=file=>new Promise((ok,no)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>no(Error("사진을 읽지 못했습니다"));reader.readAsDataURL(file)});
const imageLoaded=url=>new Promise((ok,no)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>no(Error("지원하지 않는 이미지입니다"));img.src=url});
async function compress(source,max=1280,quality=.82){const img=await imageLoaded(source);const ratio=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL("image/jpeg",quality)}
async function accept(file,type){if(!file)return;if(!file.type.startsWith("image/")||file.size>25*1024*1024){msg("photoStatus","이미지는 25MB 이하로 선택하세요.",true);return}
msg("photoStatus","사진 최적화 중...");
try{const url=await compress(await dataURL(file),type==="face"?720:1280);state[type]=url;showPhotos();if(type==="portrait"||type==="face"){$("results").hidden=true;$("sharePanel").hidden=true;state.outfits=[];state.fit="";}
await saveProfile();msg("photoStatus",type==="face"?"얼굴사진을 등록했습니다.":"전신사진을 등록했습니다.");}catch(e){msg("photoStatus",explain(e),true)}}
$("portraitCamera").onclick=()=>$("portraitInput").click();
$("portraitGallery").onclick=()=>$("portraitGalleryInput").click();
$("faceCamera").onclick=()=>$("faceInput").click();
$("faceGallery").onclick=()=>$("faceGalleryInput").click();
for(const [id,type] of [["portraitInput","portrait"],["portraitGalleryInput","portrait"],["faceInput","face"],["faceGalleryInput","face"]]){
$(id).onchange=e=>{accept(e.target.files?.[0],type);e.target.value=""}}
$("clearPhoto").onclick=async()=>{if(!confirm("등록한 전신·얼굴사진을 지울까요? 이전 코디 기록은 남습니다."))return;state.portrait="";state.face="";showPhotos();await saveProfile();notify("현재 등록 사진을 지웠습니다.")};
function demo(o){const cold=o.season==="겨울"||["추움","쌀쌀함"].includes(o.weather),hot=o.season==="여름"||o.weather==="더움";
return {outfits:[
{name:"단정한 조합",top:hot?"아이보리 반팔 셔츠":"아이보리 니트",bottom:"네이비 슬랙스",outer:cold?"차콜 코트":"가벼운 재킷",shoes:"브라운 로퍼",colors:"아이보리·네이비",why:"업무와 일상에 두루 활용할 수 있는 조합입니다."},
{name:"비즈니스 캐주얼",top:"하늘색 셔츠",bottom:"차콜 팬츠",outer:cold?"네이비 울 재킷":"얇은 블레이저",shoes:"흰색 스니커즈",colors:"블루·차콜",why:"격식과 활동성의 균형을 잡은 대안입니다."},
{name:"편안한 데일리",top:"회색 스웨터",bottom:"진청 데님",outer:cold?"경량 패딩":"가디건",shoes:"검정 스니커즈",colors:"회색·인디고",why:"편안함을 우선한 캐주얼 조합입니다."}],note:"API 미연결 상태의 예시이며 사진을 분석한 결과가 아닙니다."}}
function recommendPrompt(o){return "한국어 전문 스타일리스트. 다음 사용자 조건에 맞는 옷차림 세 벌을 1순위부터 3순위로 추천하세요: "+JSON.stringify(o)+". 모든 조합은 실제 계절과 용도에 맞고, 옷맵시가 단정하며 현실적이어야 합니다. 사진에서 관찰 가능한 색상, 옷의 실루엣, 머리 스타일만 참고하세요. 조명 때문에 피부색을 단정하지 말고, 나이·체중·건강 등 추측 금지. 원본 인물의 얼굴을 평가하지 마세요. 사진이 없으면 조건 기준으로 추천하세요. 각 결과는 name, top, bottom, outer, shoes, colors, why 필드를 포함하는 JSON만 출력하세요. 구조: {\"outfits\":[{\"name\":\"\",\"top\":\"\",\"bottom\":\"\",\"outer\":\"\",\"shoes\":\"\",\"colors\":\"\",\"why\":\"\"}],\"note\":\"\"}. outfits를 정확히 세 개 작성하고 가장 어울리는 순서대로 배열하세요."}
function parseOutfits(text){const s=text.slice(text.indexOf("{"),text.lastIndexOf("}")+1);const obj=JSON.parse(s);if(!Array.isArray(obj.outfits)||obj.outfits.length<3)throw Error("추천 결과의 형식이 올바르지 않습니다.");return obj}
function row(card,label,value){if(!value)return;const p=document.createElement("p"),strong=document.createElement("strong");strong.textContent=label+": ";p.append(strong,document.createTextNode(value));card.append(p)}
function render(outfits,demoMode=false){state.outfits=outfits.slice(0,3);state.demo=demoMode;$("looks").replaceChildren();$("shareLook").replaceChildren();
state.outfits.forEach((o,i)=>{const card=document.createElement("article");card.className="look";const h=document.createElement("h3");h.className="rank";h.textContent=(i+1)+"순위 · "+(i===0?"최우선 추천":i===1?"대안 추천":"색다른 선택");card.append(h);
row(card,"스타일",o.name);row(card,"상의",o.top);row(card,"하의",o.bottom);row(card,"겉옷",o.outer);row(card,"신발",o.shoes);row(card,"색상",o.colors);row(card,"추천 이유",o.why);
const button=document.createElement("button");button.className="btn primary";button.textContent="이 코디로 이미지 만들기";button.onclick=()=>{state.selected=i;$("shareLook").value=String(i);$("sharePanel").scrollIntoView({behavior:"smooth"});notify("구독 AI 공유 또는 Gemini 유료 자동 생성을 선택하세요.")};card.append(button);
const pay=document.createElement("button");pay.className="btn gray";pay.textContent="Gemini API로 자동 가상 피팅 (유료)";pay.onclick=()=>fit(i);if(demoMode)pay.disabled=true;card.append(pay);$("looks").append(card);
const opt=document.createElement("option");opt.value=String(i);opt.textContent=(i+1)+"순위 · "+o.name;$("shareLook").append(opt)});
$("resultNote").textContent=demoMode?"이 결과는 예시입니다. 실제 얼굴·사진 분석 결과가 아닙니다.":"추천 순위는 AI 판단이며 정답이나 실제 옷의 핏을 보장하지 않습니다.";
$("results").hidden=false;$("sharePanel").hidden=demoMode;}
$("shareLook").onchange=e=>state.selected=Number(e.target.value)||0;
function pack(){return {id:uid(),kind:"recommend",createdAt:Date.now(),options:option(),portrait:state.portrait,face:state.face,outfits:state.outfits,demo:state.demo,model:state.model}}
$("recommend").onclick=async()=>{if(state.busy)return;busy(true);msg("runStatus",state.key?"사진과 조건을 AI가 분석 중입니다.":"예시 코디를 준비합니다.");
try{const o=option();let data;if(state.key){
const parts=[{text:recommendPrompt(o)}];
if(state.portrait)parts.push({inlineData:{mimeType:"image/jpeg",data:await compress(state.portrait,960,.8).then(x=>x.split(",")[1])}});
if(state.face)parts.push({inlineData:{mimeType:"image/jpeg",data:state.face.split(",")[1]}});
const res=await textRequest({contents:[{role:"user",parts}],generationConfig:{responseMimeType:"application/json",temperature:.35,maxOutputTokens:2300}},60000);
data=parseOutfits(partsText(res));state.usage=res.usageMetadata||null;
}else data=demo(o);
render(data.outfits,!state.key);state.recordId=null;
try{const record=pack();record.note=data.note;await put(record);state.recordId=record.id;msg("runStatus",(state.key?"✅ AI 추천 완료 · "+state.model:"예시 코디 완료")+" · 기록 자동 저장됨");}
catch(e){msg("runStatus","코디 추천 완료. 단, 기록 저장 실패: "+explain(e),true)}
}catch(e){msg("runStatus","❌ "+explain(e),true)}finally{busy(false)}};
function chosen(){return state.outfits[state.selected]||state.outfits[0]}
function buildPrompt(){const o=option(),look=chosen();if(!look)return"먼저 코디를 추천받으세요.";
return ["첨부한 전신사진의 인물이 다음 옷을 실제로 착용한 것처럼 사실적인 세로 전신 이미지를 생성해 주세요.","원본 인물과 같은 얼굴, 헤어스타일, 신체 비율, 자세를 최대한 유지하세요. 별도 얼굴 사진을 첨부했다면 동일 인물의 얼굴 참고용으로 사용하세요.","다른 사람으로 바꾸거나 얼굴을 미화하거나 체형을 변경하지 마세요.","상의: "+(look.top||"없음"),"하의: "+(look.bottom||"없음"),"겉옷: "+(look.outer||"없음"),"신발: "+(look.shoes||"없음"),"색상: "+(look.colors||""),"조건: "+Object.values(o).join(" / "),"배경은 밝은 단색 스튜디오로 하고, 옷 주름과 착용감은 자연스럽게. 글자와 로고는 추가하지 마세요.","선택된 코디: "+(state.selected+1)+"순위, "+look.name].join("\n")}
$("copyPrompt").onclick=async()=>{try{await navigator.clipboard.writeText(buildPrompt());msg("shareStatus","지시문을 복사했습니다. 선택한 AI에서 붙여넣으세요.")}catch(e){msg("shareStatus","복사가 차단됐습니다. HTTPS 크롬에서 다시 시도하세요.",true)}};
function imgFile(url,name){const [h,b]=url.split(",");const mime=h.match(/data:([^;]+)/)?.[1]||"image/jpeg";const binary=atob(b);const arr=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);return new File([arr],name,{type:mime})}
$("shareFiles").onclick=async()=>{const prompt=buildPrompt();if(!chosen()){msg("shareStatus","먼저 코디를 추천받으세요.",true);return}
try{const files=[];if(state.portrait)files.push(imgFile(state.portrait,"full-body.jpg"));if(state.face)files.push(imgFile(state.face,"face.jpg"));
if(files.length&&navigator.canShare?.({files})&&navigator.share){await navigator.share({title:"푸른 AI 코디 이미지 생성",text:prompt,files});msg("shareStatus","공유를 요청했습니다. 선택한 AI 앱에서 사진·지시문 첨부를 확인하세요.");}
else if(navigator.share){await navigator.share({title:"푸른 AI 코디",text:prompt});msg("shareStatus","문장을 공유했습니다. 사진은 별도로 첨부하세요.");}
else{await navigator.clipboard.writeText(prompt);msg("shareStatus","공유가 지원되지 않아 지시문을 복사했습니다. 사진은 갤러리에서 직접 첨부하세요.");}
}catch(e){if(e.name!=="AbortError")msg("shareStatus","공유가 중단됐습니다: "+explain(e),true)}};
const services={chatgpt:"https://chatgpt.com/",gemini:"https://gemini.google.com/app",claude:"https://claude.ai/new"};
document.querySelectorAll("[data-open-ai]").forEach(b=>b.onclick=()=>{const name=b.dataset.openAi;window.open(services[name],"_blank","noopener");msg("shareStatus","AI 서비스를 열었습니다. 지시문과 사진이 자동으로 붙지 않았다면 공유 또는 복사해서 첨부하세요.")});
$("importBtn").onclick=()=>$("importResult").click();
$("importResult").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{state.cost=0;state.fit=await compress(await dataURL(f),1400,.9);showFit("구독 AI에서 가져온 이미지");await saveFittingRecord("구독 AI 가져오기");msg("shareStatus","이미지를 가져왔습니다. 기록에 저장하고 배경 편집도 가능합니다.")}catch(x){msg("shareStatus",explain(x),true)}e.target.value=""};
const fx=()=>Math.max(500,Math.min(3000,Number($("fx").value)||1450));
function price(){const usd=PRICES[$("imageModel").value]||0;return {usd,won:Math.round(usd*fx())}}
async function fit(index){if(!state.key){notify("Gemini API 키를 먼저 저장하세요.");return}if(!state.portrait){notify("가상 피팅은 전신사진이 필요합니다.");return}if(state.busy)return;
state.selected=index;const look=chosen();const amount=price();const ask="선택한 "+(index+1)+"순위 코디로 1K 이미지를 생성할까요?\n\n예상 이미지 출력 비용: 약 "+amount.won+"원 (US$"+amount.usd.toFixed(4)+")\n입력 사진·텍스트 비용 등은 별도이며 실제 청구액과 다를 수 있습니다.\n\n취소하면 과금 요청을 보내지 않습니다.";
if(!confirm(ask))return;busy(true);msg("runStatus","가상 피팅 이미지를 생성 중입니다...");
try{const prompt=buildPrompt()+"\nPhoto editing: keep the exact original person, realistic fabric, full-body portrait. Produce one image.";
const parts=[{text:prompt},{inlineData:{mimeType:"image/jpeg",data:state.portrait.split(",")[1]}}];if(state.face)parts.push({inlineData:{mimeType:"image/jpeg",data:state.face.split(",")[1]}});
const result=await request($("imageModel").value,{contents:[{role:"user",parts}],generationConfig:{responseModalities:["TEXT","IMAGE"],imageConfig:{aspectRatio:"3:4",imageSize:"1K"}}},120000);
const ip=result.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data);
if(!ip)throw Error("이미지 결과가 없습니다. 모델 권한 및 결제 설정을 확인하세요.");
state.fit="data:"+(ip.inlineData.mimeType||"image/png")+";base64,"+ip.inlineData.data;
const u=result.usageMetadata;
const inputRate={"gemini-3.1-flash-lite-image":.25,"gemini-3.1-flash-image":.50,"gemini-3-pro-image":2}[$("imageModel").value]||0;
const inputUSD=Number.isFinite(Number(u?.promptTokenCount))?Number(u.promptTokenCount)*inputRate/1000000:0;
state.cost=Math.round((amount.usd+inputUSD)*fx());
showFit("Gemini API 생성 결과");await saveFittingRecord("Gemini API · "+$("imageModel").value);
msg("runStatus","✅ 이미지 생성 완료 · 예상 "+state.cost+"원 (이미지 출력+입력 토큰 추정, 기타 출력·세금 제외)"+(u?" · 총 사용 토큰 "+(u.totalTokenCount??"확인 불가"):""));
}catch(e){msg("runStatus","❌ 이미지 생성 실패: "+explain(e),true);notify("실패 시 자동 재시도하지 않습니다. 중복 과금을 막기 위해 먼저 오류를 확인하세요.")}
finally{busy(false)}}
function showFit(title){$("fitting").hidden=false;$("fitImg").src=state.fit;msg("fitStatus",title);$("fitting").scrollIntoView({behavior:"smooth",block:"start"});}
async function saveFittingRecord(source,image=state.fit){const r={id:uid(),kind:"fitting",createdAt:Date.now(),options:option(),portrait:state.portrait,face:state.face,outfits:state.outfits,selected:state.selected,fit:image,source,estimatedOutputWon:state.cost};await put(r);state.recordId=r.id}
function download(url,name){const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove()}
$("saveFit").onclick=()=>{if(state.fit)download(state.fit,"pureun-fashion-v3-"+Date.now()+".png")};
$("openEditor").onclick=()=>{if(!state.fit)return;state.subject=state.fit;setupEditor();$("editorPanel").hidden=false;$("editorPanel").scrollIntoView({behavior:"smooth"})};
function setupEditor(){$("subjectImage").src=state.subject||state.fit;state.bg="";state.color="#ffffff";$("bgSolid").style.background="#ffffff";$("bgImage").hidden=true;msg("bgStatus","배경을 바꾸려면 먼저 '인물 배경 제거'를 누르세요.")}
const colors=[["흰색","#ffffff"],["연회색","#e6e8ed"],["보라색","#d9bce9"],["하늘색","#c4e7f8"],["남색","#233a6a"],["베이지","#ebdfd0"]];
for(const [name,hex]of colors){const b=document.createElement("button");b.className="swatch";b.title=name;b.style.background=hex;b.setAttribute("aria-label",name);b.onclick=()=>{state.color=hex;state.bg="";$("bgSolid").style.background=hex;$("bgImage").hidden=true;notify(name+" 배경 선택")};$("bgColors").append(b)}
$("chooseBackground").onclick=()=>$("backgroundInput").click();
$("backgroundInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{state.bg=await compress(await dataURL(f),1100,.85);$("bgImage").src=state.bg;$("bgImage").hidden=false;msg("bgStatus","스마트폰 사진 배경을 선택했습니다.")}catch(x){msg("bgStatus",explain(x),true)}e.target.value=""};
function loadScript(url){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=url;s.crossOrigin="anonymous";s.onload=resolve;s.onerror=()=>reject(Error("무료 배경 제거 모듈을 다운로드하지 못했습니다."));document.head.append(s)})}
let segmenter=null;
$("removeBg").onclick=async()=>{if(!state.fit)return;const b=$("removeBg");b.disabled=true;msg("bgStatus","스마트폰에서 인물 영역을 계산 중입니다. 최초에는 무료 모델을 다운로드할 수 있습니다...");
try{if(!window.SelfieSegmentation)await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js");
if(!segmenter){segmenter=new window.SelfieSegmentation({locateFile:f=>"https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/"+f});segmenter.setOptions({modelSelection:1});}
const source=await imageLoaded(state.fit);const w=source.naturalWidth,h=source.naturalHeight;
let done=false;await new Promise((resolve,reject)=>{segmenter.onResults(res=>{if(done)return;done=true;try{
const m=document.createElement("canvas");m.width=w;m.height=h;const mc=m.getContext("2d",{willReadFrequently:true});mc.drawImage(res.segmentationMask,0,0,w,h);const mask=mc.getImageData(0,0,w,h).data;
const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(source,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);
for(let i=0;i<mask.length;i+=4){const confidence=mask[i+3]<250?mask[i+3]/255:mask[i]/255;const alpha=Math.max(0,Math.min(1,(confidence-.16)/.68));pixels.data[i+3]=Math.round(pixels.data[i+3]*alpha);}
ctx.putImageData(pixels,0,0);state.subject=c.toDataURL("image/png");$("subjectImage").src=state.subject;msg("bgStatus","✅ 인물 분리 완료. 배경색이나 내 사진을 눌러 자유롭게 변경하세요.");resolve()}catch(e){reject(e)}});
segmenter.send({image:source}).catch(reject)})}
catch(e){msg("bgStatus","배경 제거 실패: "+explain(e)+". Chrome에서 다시 시도하거나 원본 이미지를 저장하세요.",true)}finally{b.disabled=false}};
async function composite(){const c=document.createElement("canvas");c.width=900;c.height=1200;const ctx=c.getContext("2d");ctx.fillStyle=state.color;ctx.fillRect(0,0,c.width,c.height);
if(state.bg){const bg=await imageLoaded(state.bg),scale=Math.max(c.width/bg.width,c.height/bg.height),w=bg.width*scale,h=bg.height*scale;ctx.drawImage(bg,(c.width-w)/2,(c.height-h)/2,w,h)}
const sub=await imageLoaded(state.subject||state.fit);const scale=Math.min(c.width/sub.width,c.height/sub.height),w=sub.width*scale,h=sub.height*scale;ctx.drawImage(sub,(c.width-w)/2,(c.height-h)/2,w,h);return c.toDataURL("image/png")}
$("exportComposite").onclick=async()=>{try{download(await composite(),"pureun-fashion-v3-background-"+Date.now()+".png");msg("bgStatus","합성 사진을 스마트폰에 다운로드했습니다.")}catch(e){msg("bgStatus",explain(e),true)}};
$("saveComposite").onclick=async()=>{try{const img=await composite();await saveFittingRecord("배경 편집",img);msg("bgStatus","앱 내 기록 갤러리에 저장했습니다.")}catch(e){msg("bgStatus","저장 실패: "+explain(e),true)}};
function date(t){return new Date(t).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
async function renderHistory(){const grid=$("historyGrid");grid.replaceChildren();let records=(await all()).filter(x=>x.id!==PROFILE).sort((a,b)=>b.createdAt-a.createdAt);
if(!records.length){const d=document.createElement("p");d.className="empty";d.textContent="저장된 코디 기록이 없습니다.";grid.append(d);return}
for(const r of records){const c=document.createElement("button");c.className="historyCard";const img=document.createElement("img");img.src=r.fit||r.portrait||"";img.alt="저장된 코디 사진";const info=document.createElement("div");info.className="info";info.textContent=date(r.createdAt)+"\n"+(r.options?.season||"")+" · "+(r.options?.style||"")+"\n"+(r.kind==="fitting"?"이미지":"코디 추천");c.append(img,info);c.onclick=()=>openRecord(r);const wrap=document.createElement("div");wrap.append(c);
const del=document.createElement("button");del.className="btn danger full";del.type="button";del.textContent="기록 삭제";del.onclick=async()=>{if(!confirm("이 기록을 삭제하시겠습니까?"))return;await remove(r.id);await renderHistory();notify("기록을 삭제했습니다.")};wrap.append(del);grid.append(wrap)}}
async function showHistory(){$("galleryPanel").hidden=false;await renderHistory();$("galleryPanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("historyBtn").onclick=showHistory;$("closeHistory").onclick=()=>$("galleryPanel").hidden=true;
async function openRecord(r){if(!r)return;
setOptions(r.options);state.portrait=r.portrait||"";state.face=r.face||"";showPhotos();if(r.outfits?.length){render(r.outfits,!!r.demo);state.selected=r.selected||0;$("shareLook").value=String(state.selected)}
if(r.fit){state.fit=r.fit;state.subject=r.fit;showFit(date(r.createdAt)+" · "+(r.source||"저장된 결과"));$("editorPanel").hidden=true;}
$("galleryPanel").hidden=true;notify("저장된 기록을 불러왔습니다.")}
$("backupBtn").onclick=async()=>{try{const list=await all();const blob=new Blob([JSON.stringify({app:"pureun-fashion-v3",version:1,createdAt:Date.now(),records:list})],{type:"application/json"});const u=URL.createObjectURL(blob);download(u,"pureun-fashion-v3-backup-"+Date.now()+".json");setTimeout(()=>URL.revokeObjectURL(u),30000);msg("saveStatus","백업 파일을 다운로드했습니다. 스마트폰 외에도 안전하게 보관하세요.")}catch(e){msg("saveStatus",explain(e),true)}};
$("restoreBtn").onclick=()=>$("restoreFile").click();
$("restoreFile").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.app!=="pureun-fashion-v3"||!Array.isArray(data.records))throw Error("V3 백업 파일이 아닙니다.");if(data.records.length>400)throw Error("백업 건수가 너무 많습니다.");
for(const r of data.records){if(typeof r.id==="string"&&r.id.length<100)await put(r)}await renderHistory();msg("saveStatus",data.records.length+"개 항목의 복원 처리를 완료했습니다. 중복된 ID는 덮어썼습니다.")}catch(x){msg("saveStatus",explain(x),true)}e.target.value=""};
let taps=0,last=0;$("version").onclick=()=>{const now=Date.now();taps=now-last<1600?taps+1:1;last=now;if(taps>=5){$("dev").classList.toggle("open");taps=0}};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.install=e;});
$("installBtn").onclick=async()=>{if(state.install){state.install.prompt();await state.install.userChoice;state.install=null}else notify("Chrome 메뉴 ⋮ → 홈 화면에 추가 또는 앱 설치를 선택하세요.")};
if("serviceWorker"in navigator){navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{})}
(async()=>{try{state.db=await openDB();const p=await one(PROFILE);if(p){state.portrait=p.portrait||"";state.face=p.face||"";showPhotos()} }
catch(e){msg("photoStatus","이 브라우저에서는 기록 저장을 사용하지 못할 수 있습니다.",true)}})();
})();