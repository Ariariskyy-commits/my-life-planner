/* MY LITTLE OFFICE — isolated local simulation.
   No planner/Firebase state is accessed. Real AI execution is intentionally not connected. */
(() => {
  'use strict';
  const KEY = 'myLifePlanner_virtualOffice_v1';
  const agents = [
    {id:'manager',name:'ขุนพล',role:'ผู้จัดการ',emoji:'👩🏻‍💼',x:38,y:39,shirt:'#7558a8',hair:'#49332e'},
    {id:'researcher',name:'ออม',role:'นักค้นคว้า',emoji:'🧑🏻‍🔬',x:62,y:34,shirt:'#4f91c7',hair:'#382b27'},
    {id:'writer',name:'ไนท์',role:'นักเขียน',emoji:'👩🏻‍🎨',x:29,y:55,shirt:'#e58b9f',hair:'#33251f'},
    {id:'designer',name:'ตุงตวง',role:'นักออกแบบ',emoji:'🧑🏼‍🎨',x:45,y:66,shirt:'#e5b34c',hair:'#b27a3c'},
    {id:'analyst',name:'ข้าวผัด',role:'นักวิเคราะห์',emoji:'👨🏻‍💻',x:55,y:70,shirt:'#5e789a',hair:'#262b32'},
    {id:'secretary',name:'ต้นกล้า',role:'เลขานุการ',emoji:'👩🏻‍💻',x:68,y:58,shirt:'#62a77b',hair:'#30231f'},
    {id:'coordinator',name:'ภีม',role:'ประสานงาน',emoji:'🧑🏻‍💼',x:78,y:67,shirt:'#c47d62',hair:'#30231f'}
  ];
  const pets = [
    {id:'cat',name:'ข้าวตัง',kind:'แมว',emoji:'🐈',mood:'กำลังงีบ',hunger:68,joy:82},
    {id:'dog',name:'ถั่วงอก',kind:'น้องหมา',emoji:'🐕',mood:'อยากเล่น',hunger:55,joy:74},
    {id:'bird',name:'กะทิ',kind:'นก',emoji:'🦜',mood:'กำลังร้องเพลง',hunger:76,joy:88}
  ];
  const $ = id => document.getElementById(id);
  let data = {tasks:[],statuses:{},petState:{},morale:{},energy:{},salary:{},life:{acOn:true,snackStock:12,companyCash:50000,lastTick:Date.now(),paused:{}}};
  let initialized = false;
  let speechTimer = null;
  let dialogueIndex = 0;
  let currentDialogueAgent = 'manager';
  let bubbleAgentId = null;
  let bubbleLine = null;
  let slackingAgentId = null;
  let loafTimer = null;
  const speech = {
    manager:['CEO วันนี้มีงานอะไรให้ทีมลุยบ้างคะ?','ทุกคนพร้อมแล้วค่ะ... รอคำสั่งอยู่นะ','อย่าลืมพักบ้างนะ CEO งานไม่หนีไปไหนหรอกค่ะ'],
    researcher:['มีเรื่องให้ค้นอีกมั้ย? สมองกำลังแล่นเลย','ฉันเปิดแท็บไว้ 27 แท็บแล้วนะ...','ข้อมูลแน่นมาก ขอเวลาย่อยแป๊บ!'],
    writer:['ว่างจัง... หรือจะให้ฉันเขียนแคปชันอีกดี?','ไอเดียมาแล้ว! ขอพิมพ์ก่อนลืม','CEO พิมพ์บรีฟมาได้เลย ฉันรออยู่'],
    designer:['ขอสีอีกนิด ทุกอย่างจะลงตัว!','ใครเอาฟอนต์ Comic Sans มาใส่ไฟล์ฉัน?!','โต๊ะฉันรกเพราะกำลังสร้างสรรค์ค่ะ'],
    analyst:['ตัวเลขไม่เคยโกหก... แต่คนชอบปัดเศษ','งานยังไม่มา ฉันเลยนั่งดูกราฟเล่น','CEO มีข้อมูลให้ฉันวิเคราะห์มั้ย?'],
    secretary:['วันนี้มีอะไรต้องจดบ้างคะ?','CEO คะ งานค้างเริ่มมองแรงแล้วนะ','ฉันเตรียมตารางไว้แล้ว อย่าลืมเปิดดูนะ'],coordinator:['ภีมพร้อมประสานงานครับ','ใครเห็นเอกสารประชุมบ้างครับ?','ขอรายชื่อคนเข้าร่วมอีกนิดครับ']
  };
  const safeText = value => String(value == null ? '' : value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function load(){try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');if(Array.isArray(p.tasks))data.tasks=p.tasks;['statuses','petState','morale','energy','salary'].forEach(k=>{if(p[k]&&typeof p[k]==='object')data[k]=p[k];});if(p.life&&typeof p.life==='object')data.life=Object.assign(data.life,p.life);}catch(e){console.warn('Office data could not be loaded',e);}agents.forEach(a=>{if(!Number.isFinite(Number(data.energy[a.id])))data.energy[a.id]=82;if(!Number.isFinite(Number(data.salary[a.id])))data.salary[a.id]=({manager:28000,researcher:22000,writer:21000,designer:22000,analyst:23000,secretary:19000,coordinator:20000})[a.id]||18000;});if(!data.life.lastTick)data.life.lastTick=Date.now();tickLife(true);}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){console.warn('Office data could not be saved',e);}}
  function statusOf(id){return data.statuses[id]||'idle';}
  function petOf(p){return Object.assign({},p,data.petState[p.id]||{});}
  function moraleOf(id){return Math.max(0,Math.min(100,Number(data.morale[id]??75)));}
  function officePeriod(){const h=new Date().getHours();return h>=6&&h<18?'day':'night';}
  function energyOf(id){return Math.max(0,Math.min(100,Number(data.energy[id]??82)));}
  function isPaused(id){return !!(data.life.paused&&data.life.paused[id]);}
  function tickLife(initial){const now=Date.now(),last=Number(data.life.lastTick)||now,minutes=Math.min(240,Math.max(0,(now-last)/60000));if(minutes>=1)agents.forEach(a=>{let e=energyOf(a.id),st=statusOf(a.id);if(isPaused(a.id)||st==='sleeping'||officePeriod()==='night')e=Math.min(100,e+minutes*(officePeriod()==='night'?1.2:1.5));else if(st==='working')e=Math.max(0,e-minutes*1.3);else e=Math.min(100,e+minutes*.35);data.energy[a.id]=Math.round(e);});data.life.lastTick=now;if(!initial)save();}
  function renderLife(){const host=$('officeLifeControls');if(!host)return;const period=officePeriod(),time=new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}),selected=$('officeLifeEmployee')?.value||'manager',a=agents.find(x=>x.id===selected)||agents[0],paused=isPaused(a.id),salary=Number(data.salary[a.id]||0),payroll=agents.reduce((sum,x)=>sum+Number(data.salary[x.id]||0),0);host.innerHTML='<div class="office-life-clock '+period+'"><b>'+(period==='day'?'☀ กลางวัน':'☾ กลางคืน')+'</b><span>'+time+'</span><small>เวลาจริงของเครื่อง · พนักงานฟื้นพลังตามช่วงเวลา</small></div><div class="office-life-summary"><span>💰 เงินเดือนรวม/เดือน <b>'+payroll.toLocaleString('th-TH')+' ฿</b></span><span>🏦 งบบริษัท <b>'+Number(data.life.companyCash||0).toLocaleString('th-TH')+' ฿</b></span></div><div class="office-life-facilities"><button type="button" data-life-action="snack" '+(Number(data.life.snackStock)<=0?'disabled':'')+'>🥤 ตู้ขนม · เหลือ '+Number(data.life.snackStock)+'</button><button type="button" data-life-action="ac">'+(data.life.acOn?'❄️ ปิดแอร์':'❄️ เปิดแอร์')+'</button><span class="office-ac-state">'+(data.life.acOn?'แอร์กำลังทำงาน':'ปิดเครื่องปรับอากาศ')+'</span></div><div class="office-hr-controls"><label>จัดการพนักงาน<select id="officeLifeEmployee">'+agents.map(x=>'<option value="'+x.id+'" '+(x.id===a.id?'selected':'')+'>'+safeText(x.name)+' — '+safeText(x.role)+'</option>').join('')+'</select></label><div class="office-hr-stats"><span>พลังงาน <b>'+energyOf(a.id)+'%</b></span><span>เงินเดือน <b>'+salary.toLocaleString('th-TH')+' ฿</b></span></div><div class="office-energy-track"><i style="width:'+energyOf(a.id)+'%"></i></div><div class="office-salary-row"><button type="button" data-life-action="raise">＋ เพิ่มเงินเดือน 1,000 ฿</button><button type="button" data-life-action="bonus">🎁 โบนัส 500 ฿</button></div><div class="office-salary-row"><button type="button" data-life-action="'+(paused?'resume':'pause')+'">'+(paused?'▶ เรียกกลับเข้าทำงาน':'⏸ สั่งพักงาน')+'</button><button type="button" data-life-action="rest">😴 ให้พักผ่อน</button></div><small class="office-life-footnote">ระบบจำลอง: เงินเดือนและงบบริษัทเป็นตัวเลขภายในเกม ไม่เกี่ยวกับเงินจริง</small></div>';const scene=document.querySelector('#tab-office .tycoon-scene');if(scene)scene.classList.toggle('office-night',period==='night');}
  function lifeAction(action){const id=$('officeLifeEmployee')?.value||'manager',a=agents.find(x=>x.id===id)||agents[0];if(action==='snack'){if(Number(data.life.snackStock)<=0){setToast('ตู้ขนมหมดแล้ว');return;}data.life.snackStock--;agents.forEach(x=>{if(!isPaused(x.id))data.energy[x.id]=Math.min(100,energyOf(x.id)+12);});data.life.companyCash=Math.max(0,Number(data.life.companyCash||0)-80);setToast('ทีมแวะเติมพลังจากตู้ขนมแล้ว 🥤');}else if(action==='ac'){data.life.acOn=!data.life.acOn;agents.forEach(x=>data.morale[x.id]=Math.min(100,moraleOf(x.id)+(data.life.acOn?3:-1)));setToast(data.life.acOn?'เปิดแอร์แล้ว ❄️':'ปิดแอร์แล้ว');}else if(action==='raise'||action==='bonus'){const cost=action==='raise'?1000:500;if(Number(data.life.companyCash||0)<cost){setToast('งบบริษัทไม่เพียงพอ');return;}data.life.companyCash-=cost;data.salary[id]=Number(data.salary[id]||0)+(action==='raise'?1000:500);data.morale[id]=Math.min(100,moraleOf(id)+8);setToast((action==='raise'?'ปรับเงินเดือน':'มอบโบนัส')+'ให้'+a.name+'แล้ว');}else if(action==='pause'){data.life.paused[id]=true;data.statuses[id]='paused';setToast('พักงาน'+a.name+'แล้ว');}else if(action==='resume'){delete data.life.paused[id];data.statuses[id]='idle';setToast('เรียก'+a.name+'กลับเข้าทำงานแล้ว');}else if(action==='rest'){data.statuses[id]='sleeping';data.energy[id]=Math.min(100,energyOf(id)+20);setToast(a.name+'กำลังพักผ่อน 😴');}save();render();}
  function setToast(message){const el=$('officeToast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(setToast.timer);setToast.timer=setTimeout(()=>el.classList.remove('show'),2600);}
  function ceoCommand(command){
    if(command==='meeting'){
      agents.forEach(a=>{data.morale[a.id]=Math.min(100,moraleOf(a.id)+4);});
      bubbleAgentId='manager';bubbleLine={text:'ประชุมทีมด่วน! ทุกคนมาอัปเดตงานกันหน่อยค่ะ',mood:'กำลังประชุม',face:'📣'};
      showDialogue(agents[0],bubbleLine);setToast('เรียกประชุมทีมแล้ว · ทุกคนพร้อมรายงานตัว!');
    }else if(command==='praise'){
      agents.forEach(a=>{data.morale[a.id]=Math.min(100,moraleOf(a.id)+8);});
      bubbleAgentId='writer';bubbleLine={text:'CEO ชมด้วย! วันนี้มีแรงทำงานขึ้นมาเลย 💗',mood:'ดีใจสุด ๆ',face:'🥰'};
      showDialogue(agents[2],bubbleLine);setToast('ชมเชยทีมเรียบร้อย · ขวัญกำลังใจเพิ่มขึ้น');
    }else if(command==='break'){
      agents.forEach(a=>{data.morale[a.id]=Math.min(100,moraleOf(a.id)+6);});
      const free=agents.filter(a=>statusOf(a.id)!=='working');
      if(free.length){const a=free[Math.floor(Math.random()*free.length)];slackingAgentId=a.id;bubbleAgentId=a.id;bubbleLine={text:'พักเบรกแล้ว! ใครเอากาแฟมั้ย ☕',mood:'พักผ่อน',face:'😌'};showDialogue(a,bubbleLine);}
      setToast('ประกาศพักเบรกให้ทีมแล้ว ☕');
    }
    save();render();
  }
  function renderStats(){
    const active=agents.filter(a=>statusOf(a.id)==='working').length;
    const done=data.tasks.filter(t=>t.status==='done').length;
    $('officeStats').innerHTML=[
      ['สมาชิกทีม',agents.length,'fa-users'],['กำลังทำงาน',active,'fa-laptop'],['งานที่เสร็จแล้ว',done,'fa-check-circle']
    ].map(x=>'<div class="office-stat"><small><i class="fa-solid '+x[2]+'"></i> '+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');
  }
  function renderAgents(){$('officeTeamCount').textContent=String(agents.length).padStart(2,'0');$('officeAgents').innerHTML=agents.map(a=>{const st=statusOf(a.id),working=st==='working',paused=isPaused(a.id),sleeping=st==='sleeping',slacking=slackingAgentId===a.id&&!working&&!paused&&!sleeping,morale=moraleOf(a.id),energy=energyOf(a.id),label=paused?'พักงาน':sleeping?'พักผ่อน':working?'กำลังทำงาน':slacking?'พักเบรก':'ว่าง';return '<button type="button" class="office-agent" data-office-agent="'+a.id+'"><span class="office-agent-avatar">'+a.emoji+'</span><span class="office-agent-info"><strong>'+a.name+'</strong><small>'+a.role+'</small><span class="office-energy-mini"><i style="width:'+energy+'%"></i></span><span class="office-morale"><i style="width:'+morale+'%"></i></span></span><span class="office-agent-status '+(working?'working':paused?'paused':sleeping?'sleeping':slacking?'slacking':'')+'">'+label+' · '+energy+'%</span></button>';}).join('');}
  function lineFor(agent){
    const working=statusOf(agent.id)==='working';
    if(isPaused(agent.id))return {text:'วันนี้พักงานอยู่ค่ะ',mood:'พักงาน',face:'⏸️',activity:'paused'};
    if(statusOf(agent.id)==='sleeping')return {text:'ขอพักเติมพลังสักครู่นะ 😴',mood:'พักผ่อน',face:'😴',activity:'sleeping'};
    if(working){
      const workLines={
        manager:['กำลังจัดคิวงานให้ทุกคนค่ะ','เช็กความคืบหน้าทีมอยู่ค่ะ'],
        researcher:['กำลังค้นข้อมูลอยู่!','เจอข้อมูลน่าสนใจแล้ว'],
        writer:['กำลังร่างข้อความให้อยู่นะ','ขอเกลาประโยคอีกนิด'],
        designer:['กำลังจัดเลย์เอาต์อยู่','เลือกสีให้เข้ากันก่อนนะ'],
        analyst:['กำลังเช็กตัวเลขอยู่','กำลังสรุปข้อมูลให้ CEO'],
        secretary:['กำลังจัดตารางนัดหมาย','กำลังอัปเดตเช็กลิสต์ค่ะ'],coordinator:['กำลังประสานงานกับทุกฝ่าย','กำลังตามเอกสารให้ครับ']
      };
      const lines=workLines[agent.id]||['กำลังทำงานอยู่'];
      return {text:lines[Math.floor(Math.random()*lines.length)],mood:'กำลังทำงาน',face:'🤓',activity:'working'};
    }
    if(slackingAgentId===agent.id){
      const loaf={
        manager:['ทีมเงียบจัง... ขอจิบกาแฟก่อนนะ','พักสายตาแป๊บ เดี๋ยวค่อยตามงาน'],
        researcher:['เปิดอ่านเรื่องแมวเพลินไปหน่อย','ขอพักสมอง 5 นาทีได้มั้ย'],
        writer:['นั่งมองหน้ากระดาษเปล่าอยู่...','ขอหาแรงบันดาลใจก่อนนะ'],
        designer:['เลื่อนดู Pinterest แป๊บเดียวเอง','กำลังเลือกวอลเปเปอร์โต๊ะอยู่'],
        analyst:['แอบเล่นเกมตัวเลขอยู่ครับ','ไม่มีข้อมูลให้วิเคราะห์ เลยว่างเลย'],
        secretary:['แอบไถมือถือแป๊บนึงค่ะ','ขอเติมกาแฟก่อนนะ CEO'],coordinator:['ขอหลบไปเติมน้ำก่อนครับ','กำลังหาโต๊ะว่างนั่งพักอยู่ครับ']
      };
      const lines=loaf[agent.id]||['ขอพักแป๊บนึง'];
      return {text:lines[Math.floor(Math.random()*lines.length)],mood:'แอบอู้',face:'😏',activity:'slacking'};
    }
    const lines=speech[agent.id]||['มีงานอะไรให้ช่วยมั้ย?'];
    const text=lines[Math.floor(Math.random()*lines.length)];
    let mood='อารมณ์ดี',face='😊';
    if(/ว่าง|27 แท็บ|มองแรง|รก|ปัดเศษ/.test(text)){mood='เริ่มเบื่อแล้ว',face='😑';}
    if(/Comic Sans|CEO คะ/.test(text)){mood='แอบหงุดหงิด',face='😤';}
    if(/ไอเดีย|สมองกำลังแล่น|พร้อมแล้ว/.test(text)){mood='ตื่นเต้น',face='🤩';}
    if(/พักบ้าง|งีบ/.test(text)){mood='ง่วงนอน',face='😴';}
    return {text,mood,face};
  }
  function showDialogue(agent,providedLine){
    if(!agent)return;
    currentDialogueAgent=agent.id;
    const line=providedLine||lineFor(agent);
    const avatar=$('officeDialogueAvatar'),name=$('officeDialogueName'),mood=$('officeDialogueMood'),text=$('officeDialogueText');
    if(avatar)avatar.textContent=agent.emoji;
    if(name)name.textContent=agent.name+' · '+agent.role;
    if(mood)mood.textContent=line.face+' '+line.mood;
    if(text)text.textContent='“'+line.text+'”';
    const scene=document.querySelectorAll('#officeSprites .office-sprite');
    scene.forEach(el=>el.classList.toggle('is-speaking',el.getAttribute('data-agent-id')===agent.id));

  }
  function refreshDialogue(){
    const candidates=agents.filter(a=>statusOf(a.id)==='working'||slackingAgentId===a.id||true);
    const agent=candidates[dialogueIndex%candidates.length];
    dialogueIndex++;
    bubbleAgentId=agent.id;
    bubbleLine=lineFor(agent);
    showDialogue(agent,bubbleLine);
    renderSprites();
  }
  function cycleLoafing(){
    const free=agents.filter(a=>statusOf(a.id)!=='working');
    if(!free.length){slackingAgentId=null;return;}
    if(slackingAgentId){slackingAgentId=null;renderSprites();renderAgents();return;}
    if(Math.random()<0.72){
      const agent=free[Math.floor(Math.random()*free.length)];
      slackingAgentId=agent.id;
      bubbleAgentId=agent.id;
      bubbleLine=lineFor(agent);
      showDialogue(agent,bubbleLine);
      renderSprites();renderAgents();
    }
  }
  function pixelCharacter(a,face){
    const hair=a.hair||'#49332e',shirt=a.shirt||'#638bd8';
    const female=['researcher','writer','designer','secretary'].includes(a.id);
    const accessory=a.id==='researcher'?'<path d="M13 24h22M15 24l-2 7m22-7 2 7" stroke="#8ad8ee" stroke-width="2.5" fill="none"/><circle cx="14" cy="25" r="3.5" fill="none" stroke="#8ad8ee" stroke-width="2"/><circle cx="34" cy="25" r="3.5" fill="none" stroke="#8ad8ee" stroke-width="2"/>':a.id==='designer'?'<path d="M8 15h32v4H8z" fill="#e7b94f"/><path d="M12 12h24v3H12z" fill="#f5d36f"/>':a.id==='analyst'?'<rect x="10" y="44" width="28" height="12" rx="2" fill="#40516c"/><rect x="13" y="46" width="22" height="7" fill="#91d8f2"/>':'';
    const hairShape=female?'<path d="M8 24V14L13 6 21 3 32 4 40 12 41 31 37 37 34 23 14 23 12 36 8 32Z" fill="'+hair+'" stroke="#392d31" stroke-width="1.5"/><path d="M10 16L15 7 26 4 37 10 31 13 22 12 15 17Z" fill="'+hair+'"/>':'<path d="M10 19L12 9 20 4 31 5 39 12 39 19 34 15 16 15Z" fill="'+hair+'" stroke="#392d31" stroke-width="1.5"/>';
    return '<svg class="pixel-person-svg" viewBox="0 0 48 68" aria-hidden="true" shape-rendering="crispEdges">'+
      '<ellipse cx="24" cy="64" rx="15" ry="3" fill="#34465a" opacity=".18"/>'+
      '<path d="M17 48h6v12h-6zM26 48h6v12h-6z" fill="#f0bd96"/>'+
      '<path d="M14 58h10v5H12v-2zM25 58h11v5H24v-2z" fill="#4b5065"/>'+
      '<path d="M10 36l5-4h18l5 4 3 15-7 3H14l-7-3z" fill="'+shirt+'" stroke="#39445b" stroke-width="1.5"/>'+
      '<path d="M18 33h12v5H18z" fill="#fff0d9"/>'+
      '<path d="M10 37L5 47l4 3 6-9M37 37l6 10-4 3-6-9" fill="#f0bd96" stroke="#cf9b7c" stroke-width="1"/>'+
      '<rect x="17" y="28" width="14" height="8" fill="#edbd98"/>'+
      '<rect x="11" y="10" width="26" height="25" rx="7" fill="#f5cba6" stroke="#bd8b70" stroke-width="1.5"/>'+
      hairShape+
      '<path d="M17 23h3v3h-3zM29 23h3v3h-3z" fill="#34313a"/>'+
      '<path d="M21 30h6v2h-6z" fill="#bd6570"/>'+
      '<path d="M13 18h5v2h-5zM30 18h5v2h-5z" fill="'+hair+'"/>'+
      accessory+
      '<path d="M15 34h18v3H15z" fill="#fff" opacity=".18"/>'+
      '</svg>';
  }
  function renderSprites(){
    const zoneLabels='<span class="office-zone manager">บริหารทีม</span><span class="office-zone researcher">วิจัย</span><span class="office-zone writer">เขียนคอนเทนต์</span><span class="office-zone designer">ออกแบบ</span><span class="office-zone analyst">วิเคราะห์</span><span class="office-zone secretary">ธุรการ</span>';
    const people=agents.map((a,i)=>{
      const working=statusOf(a.id)==='working';
      const paused=isPaused(a.id),sleeping=statusOf(a.id)==='sleeping';
      const slacking=slackingAgentId===a.id&&!working&&!paused&&!sleeping;
      const line=(bubbleAgentId===a.id&&bubbleLine)?bubbleLine:lineFor(a);
      const positions=[
        {x:37,y:41},{x:63,y:37},{x:25,y:58},{x:46,y:67},{x:56,y:73},{x:72,y:59},{x:78,y:68},{x:78,y:68}
      ];
      const pos=positions[i];
      const activityClass=working?'is-working':paused?'is-paused':sleeping?'is-sleeping':slacking?'is-slacking':'is-idle';
      const workProp=working?{
        manager:'📋',researcher:'🔎',writer:'⌨️',designer:'🎨',analyst:'📊',secretary:'🗂️',coordinator:'📞'
      }[a.id]:'';
      const bubble=bubbleAgentId===a.id&&bubbleLine?'<span class="office-mini-bubble">'+safeText(bubbleLine.text)+'</span>':'';
      const action=working?'<span class="office-work-prop">'+workProp+'</span>':(slacking||sleeping)?'<span class="office-loaf-prop">💤</span>':'';
      const energyBadge='<span class="office-energy-badge" title="พลังงาน '+energyOf(a.id)+'%">⚡ '+energyOf(a.id)+'%</span>';
      return '<button type="button" class="office-sprite '+activityClass+' role-'+a.id+'" data-agent-id="'+a.id+'" style="left:'+pos.x+'%;top:'+pos.y+'%" title="คุยกับ '+safeText(a.name)+'"><span class="office-expression">'+line.face+'</span>'+energyBadge+bubble+'<span class="office-avatar">'+pixelCharacter(a,line.face)+'</span>'+action+'<span class="office-name">'+a.name+'</span><span class="office-role-tag">'+({manager:'หัวหน้าทีม',researcher:'วิจัย',writer:'เขียน',designer:'ออกแบบ',analyst:'วิเคราะห์',secretary:'ธุรการ',coordinator:'ประสานงาน'}[a.id])+'</span></button>';
    }).join('');
    const petSprites='<div class="office-pet-sprite cat" data-pet-id="cat" title="ข้าวตัง แมวประจำออฟฟิศ">🐈<small>ข้าวตัง</small></div><div class="office-pet-sprite dog" data-pet-id="dog" title="ถั่วงอก น้องหมาประจำออฟฟิศ">🐕<small>ถั่วงอก</small></div><div class="office-pet-sprite bird" data-pet-id="bird" title="กะทิ นกประจำออฟฟิศ">🦜<small>กะทิ</small></div>';
    $('officeSprites').innerHTML=zoneLabels+people+petSprites;
  }
  function renderPets(){
    const host=$('officePets'); if(!host)return;
    host.innerHTML=pets.map(p=>{
      const s=petOf(p);
      const hunger=Math.max(0,Math.min(100,Number(s.hunger)||0)),joy=Math.max(0,Math.min(100,Number(s.joy)||0));
      const mood=hunger<25?'หิวแล้ว ขอขนมหน่อย':joy<25?'เหงาจัง มาเล่นกัน':'อารมณ์ดี · '+safeText(s.mood);
      return '<article class="office-pet"><span class="office-pet-face">'+p.emoji+'</span><strong>'+p.name+' · '+p.kind+'</strong><small>'+mood+'</small><div class="office-pet-meter"><span>ความอิ่ม</span><b>'+hunger+'%</b><i><em style="width:'+hunger+'%"></em></i></div><div class="office-pet-meter joy"><span>ความสุข</span><b>'+joy+'%</b><i><em style="width:'+joy+'%"></em></i></div><div class="office-pet-actions"><button type="button" data-pet-action="feed" data-pet="'+p.id+'">🍎 ให้อาหาร</button><button type="button" data-pet-action="play" data-pet="'+p.id+'">🎾 เล่นด้วย</button></div></article>';
    }).join('');
  }
  function renderTasks(){
    const list=$('officeTaskList');
    if(!data.tasks.length){list.innerHTML='<div class="office-empty">ยังไม่มีงานในออฟฟิศ ✦<br>พิมพ์คำสั่งให้ขุนพลได้เลย</div>';return;}
    list.innerHTML=data.tasks.slice().sort((a,b)=>b.created-a.created).map(t=>{
      if(t.isCEOFlow){
        const done=t.status==='done',revision=t.status==='revision';
        const team=(t.workflowSteps||[]).map(s=>safeText(s.name)).join(' → ');
        return '<article class="office-task office-ceo-review"><div class="office-task-head"><h4>'+safeText(t.title)+'</h4><span class="office-task-state '+(done?'done':revision?'review':'review')+'">'+(done?'CEO อนุมัติแล้ว':revision?'ส่งกลับให้ทีมแก้ไข':'รอ CEO ตรวจงาน')+'</span></div><p>'+safeText(t.detail||'ทีมได้รับคำสั่งจาก CEO และจัดลำดับงานแล้ว')+'</p><div class="office-flow-line"><b>ทีมที่ร่วมงาน</b><span>'+team+'</span></div><div class="office-flow-progress">'+(t.workflowSteps||[]).map(s=>'<span class="is-complete">✓ '+safeText(s.name)+'</span>').join('')+'</div><section class="office-ceo-deliverable"><div class="office-ceo-deliverable-head"><b>ผลงานสำหรับตรวจ</b><small>ฉบับจำลอง · ยังไม่ใช่ข้อมูลที่ AI ค้นคว้าจริง</small></div><div class="office-ceo-deliverable-body">'+safeText(t.work||'ยังไม่มีเนื้อหาผลงาน')+'</div></section>'+(t.revisionNote?'<div class="office-revision-note"><b>คำสั่งแก้ไขล่าสุด</b><p>'+safeText(t.revisionNote)+'</p></div>':'')+(done?'<div class="office-approved-note">✓ งานนี้ได้รับการอนุมัติแล้ว</div>':'<div class="office-ceo-actions"><textarea data-office-revision-input="'+t.id+'" rows="2" placeholder="ถ้ายังไม่โอเค บอกขุนพลว่าต้องแก้ตรงไหน...">'+(revision?'':'')+'</textarea><div><button type="button" class="office-approve-btn" data-office-approve="'+t.id+'">✓ อนุมัติและจบงาน</button><button type="button" class="office-revise-btn" data-office-revise="'+t.id+'">↻ ส่งกลับให้ทีมแก้ไข</button></div></div>')+'</article>';
      }
      const agent=agents.find(a=>a.id===t.agent),done=t.status==='done',review=t.status==='review',queued=t.status==='queued';
      const stateLabel=done?'เสร็จแล้ว':review?'ส่งรายงานแล้ว · รอตรวจ':queued?'รอรับช่วงต่อ':'งานเดิม · กำลังดำเนินการ';
      return '<details class="office-legacy-task"><summary><b>'+safeText(t.title)+'</b><span>'+stateLabel+'</span></summary><article class="office-task"><p>'+safeText(t.detail||'ไม่มีรายละเอียดเพิ่มเติม')+'</p><div class="office-task-meta"><span>ผู้รับผิดชอบ: '+safeText(agent?agent.name:'ทีม')+'</span><span>'+new Date(t.created).toLocaleDateString('th-TH')+'</span></div>'+(t.work?'<section class="office-deliverable-preview"><b>ผลงานเดิม</b><p>'+safeText(t.work)+'</p></section>':'')+(done?'':'<button type="button" data-office-done="'+t.id+'">✓ รับรองงานเสร็จ</button>')+' <button type="button" data-office-delete="'+t.id+'">ลบงานเดิม</button></article></details>';
    }).join('');
  }
  function renderManagerReports(){
    const host=$('officeManagerReports');if(!host)return;
    const reports=data.tasks.filter(t=>!t.isCEOFlow&&(String(t.report||'').trim()||String(t.work||'').trim())).sort((a,b)=>(b.reportedAt||b.workSavedAt||0)-(a.reportedAt||a.workSavedAt||0));
    if(!reports.length){host.innerHTML='<div class="office-empty">ยังไม่มีผลงานหรือรายงานจากทีม เมื่อบันทึกผลงานแล้ว จะปรากฏที่นี่</div>';return;}
    host.innerHTML=reports.map(t=>{
      const agent=agents.find(a=>a.id===t.agent);
      return '<article class="office-report-card"><div><strong>'+safeText(agent?agent.name:'ทีม')+'</strong><span>'+safeText(t.title)+'</span></div>'+(t.work?'<section class="office-deliverable-preview"><b>ผลงานที่ส่งมอบ</b><p>'+safeText(t.work)+'</p><small>บันทึกเมื่อ '+new Date(t.workSavedAt||t.created).toLocaleString('th-TH')+'</small></section>':'')+(t.report?'<section class="office-report-preview"><b>รายงานความคืบหน้า</b><p>'+safeText(t.report)+'</p><small>ส่งรายงานเมื่อ '+new Date(t.reportedAt||t.created).toLocaleString('th-TH')+'</small></section>':'')+'</article>';
    }).join('');
  }
  function saveWork(id){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    const input=document.querySelector('[data-office-work-input="'+id+'"]');
    const work=input?input.value.trim():'';
    if(!work){setToast('ใส่เนื้อหาผลงานก่อนบันทึกนะคะ');return;}
    task.work=work;task.workSavedAt=Date.now();save();render();
    setToast('บันทึกผลงานของทีมเรียบร้อยแล้ว');
  }
  function submitReport(id){
    const task=data.tasks.find(t=>t.id===id);if(!task||task.status==='done')return;
    const input=document.querySelector('[data-office-report-input="'+id+'"]');
    const report=input?input.value.trim():'';
    if(!report){setToast('เขียนรายงานก่อนส่งให้ขุนพลนะคะ');return;}
    task.report=report;task.reportedAt=Date.now();task.status='review';
    if(!data.tasks.some(t=>t.agent===task.agent&&t.status==='doing'))data.statuses[task.agent]='idle';
    save();render();setToast('ส่งรายงานให้ขุนพลเรียบร้อยแล้ว');
  }

  function buildOfficeDraft(command, revisionNote){
    const raw=String(command||'').trim();
    const subject=raw.replace(/^(ช่วย|ขอให้|รบกวน|ทำ|สร้าง|จัดทำ|อยากให้)+/,'').trim()||raw;
    const isContent=/(บทความ|แคปชัน|ประชาสัมพันธ์|คอนเทนต์|โพสต์|สื่อ)/.test(raw);
    const isDesign=/(ออกแบบ|โปสเตอร์|อินโฟกราฟิก|ภาพประกอบ|กราฟิก)/.test(raw);
    const isPlan=/(แผน|โครงการ|กิจกรรม|กำหนดการ|ตาราง)/.test(raw);
    const isLibrary=/(ห้องสมุด|พิพิธภัณฑ์|กรมพลศึกษา|มรดกทางกีฬา|กีฬา)/.test(raw);
    const isYouth=/(วัยรุ่น|เยาวชน|นักเรียน|นักศึกษา|gen ?z)/i.test(raw);
    const audience=isYouth?'วัยรุ่นและเยาวชน':'ประชาชนทั่วไป';
    const ideas=isLibrary?[
      ['เปิดคลังสมบัติกีฬา','พาชมวัตถุหรือของสะสมชิ้นเด่นในพิพิธภัณฑ์ เล่าเรื่องว่าของชิ้นนี้เกี่ยวข้องกับประวัติศาสตร์กีฬาอย่างไร','ของชิ้นเล็ก ๆ อาจซ่อนเรื่องราวกีฬาที่ยิ่งใหญ่ไว้ มาทำความรู้จักมรดกทางกีฬาที่ห้องสมุดและพิพิธภัณฑ์การพลศึกษาและกีฬา กรมพลศึกษา'],
      ['ห้องสมุดไม่ได้มีแค่หนังสือ','แนะนำมุมอ่าน หนังสือกีฬา สื่อความรู้ และพื้นที่ค้นคว้า พร้อมภาพบรรยากาศจริง','อยากรู้เรื่องกีฬาให้มากกว่าในสนาม? แวะมาค้นพบหนังสือและเรื่องราวใหม่ ๆ ได้ที่ห้องสมุดกรมพลศึกษา'],
      ['รู้หรือไม่? เรื่องกีฬาใกล้ตัว','หยิบเกร็ดความรู้เกี่ยวกับกีฬา การออกกำลังกาย หรือประวัติบุคคล/อุปกรณ์กีฬามาเล่าเป็นโพสต์สั้น','รู้หรือไม่ว่าเรื่องราวเบื้องหลังกีฬาใกล้ตัวมีอะไรน่าสนใจอีกเพียบ เซฟโพสต์นี้ไว้ แล้วมาเรียนรู้ไปด้วยกัน'],
      ['หนึ่งภาพเล่าเรื่องกีฬา','นำภาพเก่า ภาพกิจกรรม หรือวัตถุจัดแสดงมาเทียบกับเรื่องราวในปัจจุบัน โดยตรวจสอบที่มาของภาพก่อนเผยแพร่','ภาพหนึ่งภาพพาเราย้อนเวลาได้ มองกีฬาในมุมที่มากกว่าการแข่งขัน ผ่านเรื่องเล่าจากคลังความทรงจำของเรา'],
      ['เช็กอินพื้นที่เรียนรู้','ทำโพสต์แนะนำวิธีเข้าชม จุดเด่น และข้อมูลการติดต่อ โดยเติมวันเวลาและรายละเอียดล่าสุดก่อนเผยแพร่','เปลี่ยนวันว่างให้เป็นวันค้นพบ! ชวนเพื่อนมาเปิดประสบการณ์เรียนรู้เรื่องพลศึกษาและกีฬาในพื้นที่เดียวกัน']
    ]:[
      ['เริ่มจากเรื่องใกล้ตัว','หยิบประเด็นที่กลุ่มเป้าหมายพบในชีวิตประจำวันมาเล่าให้เข้าใจง่าย','เรื่องดี ๆ เริ่มได้จากสิ่งใกล้ตัว ลองเปิดมุมมองใหม่ แล้วค้นหาสิ่งที่ใช่สำหรับคุณ'],
      ['รู้หรือไม่?','นำข้อเท็จจริงที่ตรวจสอบแหล่งที่มาแล้วมาเล่าเป็นเกร็ดสั้น ๆ','มีเรื่องนี้ที่คุณอาจยังไม่รู้! อ่านจบแล้วอย่าลืมแชร์ต่อให้เพื่อน'],
      ['ทำตามได้ทันที','ทำเป็นขั้นตอนสั้น ๆ ที่ผู้อ่านนำไปใช้ได้จริง','เซฟไว้ทำตามได้เลย เริ่มทีละขั้น ไม่ต้องรอให้พร้อมทุกอย่าง'],
      ['ชวนเพื่อนมีส่วนร่วม','ตั้งคำถาม โพล หรือชาเลนจ์ที่เหมาะกับหัวข้อ','คุณอยู่ทีมไหน? คอมเมนต์บอกกันหน่อย แล้วชวนเพื่อนมาเล่นด้วยกัน'],
      ['สรุปให้ในโพสต์เดียว','รวบรวมประเด็นสำคัญเป็นภาพหรือรายการอ่านง่าย','ไม่มีเวลายาว ๆ ก็รู้เรื่องได้ สรุปประเด็นสำคัญมาให้แล้วในโพสต์เดียว']
    ];
    let out='ผลงานสำหรับ CEO ตรวจ\nคำสั่ง: '+raw+'\n\n';
    out+='ภาพรวมงาน\nเป้าหมาย: จัดทำผลงานให้ตรงคำสั่งและพร้อมนำไปตรวจแก้ก่อนเผยแพร่\nกลุ่มเป้าหมาย: '+audience+'\nรูปแบบงาน: '+(isContent?'ชุดคอนเทนต์และแคปชัน':isDesign?'แนวทางออกแบบสื่อ':isPlan?'แผนดำเนินงาน':'ข้อเสนอการดำเนินงาน')+'\n\n';
    if(isContent||isLibrary){
      out+='ผลงานจากไนท์ · คอนเทนต์ 5 หัวข้อ\n';
      ideas.forEach((x,i)=>{out+=(i+1)+'. '+x[0]+'\nแนวเนื้อหา: '+x[1]+'\nแคปชัน: '+x[2]+'\n\n';});
    }
    if(isDesign||isContent){
      out+='ผลงานจากตุงตวง · แนวทางภาพประกอบ\n';
      ideas.forEach((x,i)=>{out+='ภาพ '+(i+1)+' — '+x[0]+': ใช้ภาพหลัก 1 ภาพที่สื่อหัวข้อได้ทันที วางพาดหัวสั้นด้านบน ใช้ข้อความประกอบไม่เกิน 2–3 บรรทัด และใส่ชื่อหน่วยงาน/แหล่งข้อมูลไว้ส่วนท้าย\n';});
      out+='แนวภาพรวม: สดใส ทันสมัย อ่านง่าย ใช้ภาพถ่ายหรือภาพวัตถุจริงเป็นหลัก หลีกเลี่ยงการใส่ข้อความแน่นเกินไป\nสัดส่วนแนะนำ: โพสต์ 1:1 หรือ 4:5 และ Story 9:16\n\n';
    }
    out+='ผลงานจากออม · ขอบเขตการค้นคว้า\n- รวบรวมข้อมูลประวัติ ความเป็นมา และรายละเอียดของหัวข้อจากเอกสารหรือแหล่งข้อมูลทางการ\n- ตรวจสอบชื่อเฉพาะ วันที่ ตัวเลข และเครดิตภาพก่อนนำมาใช้\n- จัดทำรายการแหล่งอ้างอิงให้ทีมแนบในฉบับเผยแพร่\nหมายเหตุ: ระบบจำลองยังไม่ได้ค้นคว้าหรือยืนยันแหล่งข้อมูลจริง\n\n';
    out+='ผลงานจากข้าวผัด · วิเคราะห์กลุ่มเป้าหมาย\n- ใช้ข้อความสั้น อ่านง่าย และมีประเด็นชัดในช่วงต้น\n- เน้นภาพที่สะดุดตาและข้อมูลที่นำไปใช้หรือแชร์ต่อได้\n- ชวนมีส่วนร่วมด้วยคำถามหรือคำชวนทำกิจกรรม โดยไม่ใช้ภาษาทางการมากเกินไป\n\n';
    out+='ผลงานจากต้นกล้า · จัดชุดส่งมอบ\n- คอนเทนต์ 5 หัวข้อ พร้อมแคปชัน\n- แนวทางภาพประกอบ 5 ชิ้น\n- รายการข้อมูลและเครดิตที่ต้องตรวจสอบก่อนเผยแพร่\n- เช็กลิสต์ตรวจคำสะกด ชื่อหน่วยงาน และช่องทางติดต่อ\n\n';
    out+='ผลงานจากภีม · แผนประสานงาน\n1. ขอข้อมูลและภาพต้นฉบับจากผู้รับผิดชอบ\n2. ส่งร่างให้เจ้าของข้อมูลตรวจความถูกต้อง\n3. ส่งแบบภาพให้ CEO อนุมัติ\n4. กำหนดวันเผยแพร่และช่องทางหลังได้รับอนุมัติ\n\n';
    if(isPlan)out+='แผนดำเนินงานเพิ่มเติม\n1. ยืนยันเป้าหมายและผู้รับผิดชอบ\n2. รวบรวมข้อมูลและทรัพยากร\n3. ผลิตชิ้นงานและตรวจสอบ\n4. ขออนุมัติและเผยแพร่\n5. สรุปผลจากการเข้าถึงและการมีส่วนร่วม\n\n';
    out+='ข้อเสนอจากขุนพล · สรุปเพื่อการตัดสินใจ\nทีมจัดชุดร่างเบื้องต้นตามคำสั่งแล้ว ขั้นต่อไปขอให้ CEO ตรวจความถูกต้องของเนื้อหา ภาพ และข้อมูลหน่วยงาน ก่อนอนุมัติใช้งานจริง\n\n';
    out+='รายการที่ต้องยืนยันก่อนเผยแพร่\n- ข้อมูลข้อเท็จจริงและแหล่งอ้างอิง\n- ภาพถ่าย/สิทธิ์การใช้ภาพและคำบรรยายภาพ\n- วัน เวลา สถานที่ และช่องทางติดต่อ (ถ้ามี)\n- ผู้อนุมัติเนื้อหาจากหน่วยงาน\n\n';
    out+='หมายเหตุระบบ: ผลงานนี้สร้างจากชุดกฎและแม่แบบของออฟฟิศจำลอง ไม่ได้เชื่อม AI จริง ไม่ได้ค้นเว็บ และไม่ได้สร้างไฟล์ภาพจริง';
    if(revisionNote)out+='\n\nคำขอแก้ไขจาก CEO\n'+revisionNote+'\nสถานะ: บันทึกคำขอแก้ไขแล้ว ฉบับนี้เป็นการปรับตามแม่แบบจำลอง โปรดตรวจว่าตรงความต้องการก่อนอนุมัติ';
    return out;
  }
  function routeOfficeCommand(raw){
    const command=String(raw||'').trim();
    if(!command){setToast('พิมพ์คำสั่งก่อนนะคะ');return;}
    const route=agents.filter(a=>a.id!=='manager');
    const now=Date.now();
    const id='office_ceo_'+now+'_'+Math.random().toString(36).slice(2,7);
    const title=command.length>90?command.slice(0,87)+'…':command;
    const steps=route.map((a,index)=>({id:a.id,name:a.name,role:a.role,status:'completed',order:index}));
    data.tasks.push({id,title:'คำสั่ง CEO: '+title,detail:'ขุนพลรับคำสั่งแล้ว และจัดทีมทำงานต่อเนื่องโดยไม่ต้องส่งต่องานทีละคน',command:command,agent:'manager',status:'review',created:now,isCEOFlow:true,workflowSteps:steps,work:buildOfficeDraft(command),workSavedAt:now});
    route.forEach(a=>{data.statuses[a.id]='idle';data.morale[a.id]=Math.min(100,moraleOf(a.id)+2);});
    data.statuses.manager='idle';save();render();
    bubbleAgentId='manager';bubbleLine={text:'รับทราบค่ะ CEO! ขุนพลจัดทีมและรวบรวมผลงานฉบับทดลองไว้ให้ตรวจแล้วค่ะ',mood:'ส่งงานให้ CEO ตรวจ',face:'📋'};
    showDialogue(agents[0],bubbleLine);setToast('ทีมจำลองทำงานครบแล้ว · รอ CEO ตรวจผลงาน');
    const input=$('officeAiCommandInput');if(input)input.value='';
  }
  function approveOfficeWorkflow(id){
    const task=data.tasks.find(t=>t.id===id&&t.isCEOFlow);if(!task)return;
    task.status='done';task.approvedAt=Date.now();save();render();
    setToast('CEO อนุมัติแล้ว · ปิดงานเรียบร้อย');
    bubbleAgentId='manager';bubbleLine={text:'ขอบคุณค่ะ CEO! งานนี้ปิดเรียบร้อยแล้วนะคะ',mood:'ปิดงานสำเร็จ',face:'🎉'};showDialogue(agents[0],bubbleLine);
  }
  function reviseOfficeWorkflow(id){
    const task=data.tasks.find(t=>t.id===id&&t.isCEOFlow);if(!task||task.status==='done')return;
    const input=document.querySelector('[data-office-revision-input="'+id+'"]');
    const note=input?input.value.trim():'';
    if(!note){setToast('บอกขุนพลก่อนนะคะว่าต้องการให้แก้ตรงไหน');return;}
    task.revisionNote=note;task.revisionCount=(task.revisionCount||0)+1;task.status='review';const originalCommand=task.command||((task.work||'').match(/คำสั่ง: ([^\\n]+)/)||[])[1]||task.title.replace(/^คำสั่ง CEO: /,'');task.command=originalCommand;task.work=buildOfficeDraft(originalCommand,note);task.workSavedAt=Date.now();task.revisionAt=Date.now();
    save();render();setToast('ทีมรับคำขอแก้ไขแล้ว · แสดงฉบับจำลองให้ตรวจอีกครั้ง');
  }

  function render(){renderStats();renderAgents();renderSprites();renderPets();renderTasks();renderManagerReports();renderLife();}
  function completeTask(id){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    task.status='done';
    if(task.workflowId){
      const next=data.tasks.find(t=>t.workflowId===task.workflowId&&t.workflowOrder===Number(task.workflowOrder)+1);
      if(next&&next.status==='queued'){
        next.status='doing';
        next.detail+='\n\nผลงานส่งต่อจาก '+(agents.find(a=>a.id===task.agent)?.name||'ทีม')+':\n'+(task.work||task.report||'ยังไม่มีรายละเอียดผลงานแนบมา');
        data.statuses[next.agent]='working';
        data.morale[next.agent]=Math.min(100,moraleOf(next.agent)+2);
        setToast('ส่งต่องานให้ '+(agents.find(a=>a.id===next.agent)?.name||'ทีม')+' แล้ว');
      }
    }
    if(slackingAgentId===task.agent)slackingAgentId=null;
    data.morale[task.agent]=Math.min(100,moraleOf(task.agent)+5);
    if(!data.tasks.some(t=>t.agent===task.agent&&t.status==='doing'))data.statuses[task.agent]='idle';
    save();render();
  }
  function editTask(id){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    const title=window.prompt('แก้ไขชื่องาน',task.title||'');
    if(title===null)return;
    if(!title.trim()){setToast('กรุณาระบุชื่องาน');return;}
    const detail=window.prompt('แก้ไขรายละเอียดงาน',task.detail||'');
    if(detail===null)return;
    task.title=title.trim();task.detail=detail.trim();
    save();render();setToast('บันทึกการแก้ไขงานเรียบร้อยแล้ว');
  }
  function deleteTask(id){
    const task=data.tasks.find(t=>t.id===id);data.tasks=data.tasks.filter(t=>t.id!==id);
    if(task&&slackingAgentId===task.agent)slackingAgentId=null;
    if(task&&!data.tasks.some(t=>t.agent===task.agent&&t.status==='doing'))data.statuses[task.agent]='idle';
    save();render();
  }
  function petAction(id,action){
    const p=pets.find(x=>x.id===id);if(!p)return;
    const s=petOf(p);
    if(action==='feed'){s.hunger=Math.min(100,(s.hunger||50)+28);s.mood='อิ่มท้องแล้ว ขอบคุณนะ';}
    if(action==='play'){s.joy=Math.min(100,(s.joy||50)+26);s.mood='มีความสุขสุด ๆ';}
    data.petState[id]={hunger:s.hunger,joy:s.joy,mood:s.mood};save();renderPets();
    const petLines={cat:action==='feed'?'ข้าวตังอิ่มแล้ว ขอไปนอนบนเอกสารนะ!':'ข้าวตัง: จับหนูให้ดูมั้ย?',dog:action==='feed'?'ถั่วงอกงั่ม ๆ ขออีกได้มั้ย!':'ถั่วงอก: โยนลูกบอลมาเลย CEO!',bird:action==='feed'?'กะทิอิ่มแล้ว จิ๊บ ๆ':'กะทิ: ขอเกาะไหล่หน่อย!'};
    const host=agents[Math.floor(Math.random()*agents.length)];bubbleAgentId=host.id;bubbleLine={text:petLines[id],mood:action==='feed'?'อิ่มแปล้':'กำลังเล่นกับสัตว์เลี้ยง',face:action==='feed'?'😋':'🥰'};showDialogue(host,bubbleLine);renderSprites();
  }
  function startPetRoaming(){
    const routes={cat:[{x:15,y:72},{x:28,y:61},{x:42,y:76},{x:58,y:64},{x:70,y:75},{x:49,y:81}],dog:[{x:77,y:77},{x:64,y:69},{x:50,y:78},{x:33,y:73},{x:22,y:62},{x:60,y:57}],bird:[{x:82,y:29},{x:70,y:25},{x:58,y:33},{x:45,y:25},{x:66,y:42},{x:84,y:36}]};
    const steps={cat:0,dog:2,bird:1};
    setInterval(()=>{
      Object.keys(routes).forEach(id=>{const el=document.querySelector('#officeSprites [data-pet-id="'+id+'"]');if(!el)return;const route=routes[id],p=route[steps[id]%route.length];steps[id]++;el.style.left=p.x+'%';el.style.top=p.y+'%';el.classList.add('is-roaming');});
      if(Math.random()<.42){
        const id=['cat','dog','bird'][Math.floor(Math.random()*3)],agent=agents[Math.floor(Math.random()*agents.length)];
        const lines={cat:['ข้าวตัง! อย่าเดินบนคีย์บอร์ดสิ งานหายหมดแล้ว!','ข้าวตังแอบหลับบนแฟ้มอีกแล้ว'],dog:['ถั่วงอก! อย่าคาบเอกสารประชุมไป!','ถั่วงอกวิ่งชนโต๊ะอีกแล้ว!'],bird:['กะทิ! อย่าจิกสายเมาส์นะ!','กะทิร้องประชุมแทน CEO แล้วเหรอ']};
        bubbleAgentId=agent.id;bubbleLine={text:lines[id][Math.floor(Math.random()*lines[id].length)],mood:'โดนสัตว์เลี้ยงป่วน',face:'😵'};showDialogue(agent,bubbleLine);renderSprites();
      }
    },3200);
  }
  function init(){
    if(initialized||!$('officeApp'))return;
    initialized=true;load();render();
    if(speechTimer)clearInterval(speechTimer);
    showDialogue(agents[0]);
    speechTimer=setInterval(refreshDialogue,6200);
    setInterval(()=>{tickLife(false);pets.forEach(p=>{const s=petOf(p);s.hunger=Math.max(0,(Number(s.hunger)||50)-1);s.joy=Math.max(0,(Number(s.joy)||50)-1);if(s.hunger<25)s.mood='หิวแล้ว ขอขนมหน่อย';else if(s.joy<25)s.mood='เหงาจัง มาเล่นกัน';data.petState[p.id]={hunger:s.hunger,joy:s.joy,mood:s.mood};});save();render();},60000);
    if(loafTimer)clearInterval(loafTimer);
    loafTimer=setInterval(cycleLoafing,9000);
    startPetRoaming();
    const aiForm=$('officeAiCommandForm');if(aiForm)aiForm.addEventListener('submit',e=>{e.preventDefault();routeOfficeCommand($('officeAiCommandInput').value);});
    const lifeHost=$('officeLifeControls');if(lifeHost){lifeHost.addEventListener('click',e=>{const b=e.target.closest('[data-life-action]');if(b)lifeAction(b.getAttribute('data-life-action'));});lifeHost.addEventListener('change',e=>{if(e.target.id==='officeLifeEmployee')renderLife();});}setInterval(()=>{tickLife(false);renderAgents();renderSprites();renderLife();},30000);
    setInterval(()=>{tickLife(false);renderAgents();renderSprites();renderLife();},30000);
    $('officeTaskList').addEventListener('click',e=>{
      const done=e.target.closest('[data-office-done]'),del=e.target.closest('[data-office-delete]'),edit=e.target.closest('[data-office-edit]'),report=e.target.closest('[data-office-report]'),work=e.target.closest('[data-office-work-save]'),approve=e.target.closest('[data-office-approve]'),revise=e.target.closest('[data-office-revise]');
      if(done)completeTask(done.getAttribute('data-office-done'));
      if(del)deleteTask(del.getAttribute('data-office-delete'));
      if(edit)editTask(edit.getAttribute('data-office-edit'));
      if(report)submitReport(report.getAttribute('data-office-report'));
      if(work)saveWork(work.getAttribute('data-office-work-save'));
      if(approve)approveOfficeWorkflow(approve.getAttribute('data-office-approve'));
      if(revise)reviseOfficeWorkflow(revise.getAttribute('data-office-revise'));
    });
    $('officeAgents').addEventListener('click',e=>{
      const btn=e.target.closest('[data-office-agent]');if(btn){const id=btn.getAttribute('data-office-agent');const agent=agents.find(a=>a.id===id);bubbleAgentId=id;bubbleLine=lineFor(agent);showDialogue(agent,bubbleLine);renderSprites();}
    });
    $('officeSprites').addEventListener('click',e=>{
      const btn=e.target.closest('[data-agent-id]');
      if(btn){const id=btn.getAttribute('data-agent-id');const agent=agents.find(a=>a.id===id);bubbleAgentId=id;bubbleLine=lineFor(agent);showDialogue(agent,bubbleLine);renderSprites();}
    });
    $('officeCommandBar').addEventListener('click',e=>{const btn=e.target.closest('[data-ceo-command]');if(btn)ceoCommand(btn.getAttribute('data-ceo-command'));});
    $('officePets').addEventListener('click',e=>{
      const btn=e.target.closest('[data-pet-action]');if(btn)petAction(btn.getAttribute('data-pet'),btn.getAttribute('data-pet-action'));
    });
  }
  document.addEventListener('DOMContentLoaded',init);
  window.addEventListener('load',init);
  window.addEventListener('storage',e=>{if(e.key===KEY){load();render();}});
  window.MyLifePlannerOffice={init,render,ceoCommand,routeOfficeCommand,approveOfficeWorkflow,reviseOfficeWorkflow,lifeAction};
})();
