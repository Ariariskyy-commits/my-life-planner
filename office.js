/* MY LITTLE OFFICE — isolated local simulation.
   No planner/Firebase state is accessed. Real AI execution is intentionally not connected. */
(() => {
  'use strict';
  const KEY = 'myLifePlanner_virtualOffice_v1';
  const agents = [
    {id:'manager',name:'Mika',role:'ผู้จัดการ',emoji:'👩🏻‍💼',x:38,y:39,shirt:'#7558a8',hair:'#49332e'},
    {id:'researcher',name:'Nori',role:'นักค้นคว้า',emoji:'🧑🏻‍🔬',x:62,y:34,shirt:'#4f91c7',hair:'#382b27'},
    {id:'writer',name:'Momo',role:'นักเขียน',emoji:'👩🏻‍🎨',x:29,y:55,shirt:'#e58b9f',hair:'#33251f'},
    {id:'designer',name:'Kiki',role:'นักออกแบบ',emoji:'🧑🏼‍🎨',x:45,y:66,shirt:'#e5b34c',hair:'#b27a3c'},
    {id:'analyst',name:'Theo',role:'นักวิเคราะห์',emoji:'👨🏻‍💻',x:55,y:70,shirt:'#5e789a',hair:'#262b32'},
    {id:'secretary',name:'Pim',role:'เลขานุการ',emoji:'👩🏻‍💻',x:68,y:58,shirt:'#62a77b',hair:'#30231f'}
  ];
  const pets = [
    {id:'cat',name:'มะลิ',kind:'แมว',emoji:'🐈',mood:'กำลังงีบ',hunger:68,joy:82},
    {id:'dog',name:'โมจิ',kind:'น้องหมา',emoji:'🐕',mood:'อยากเล่น',hunger:55,joy:74},
    {id:'bird',name:'จิ๊บจิ๊บ',kind:'นก',emoji:'🦜',mood:'กำลังร้องเพลง',hunger:76,joy:88}
  ];
  const $ = id => document.getElementById(id);
  let data = {tasks:[],statuses:{},petState:{},morale:{}};
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
    secretary:['วันนี้มีอะไรต้องจดบ้างคะ?','CEO คะ งานค้างเริ่มมองแรงแล้วนะ','ฉันเตรียมตารางไว้แล้ว อย่าลืมเปิดดูนะ']
  };
  const safeText = value => String(value == null ? '' : value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function load(){
    try{
      const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');
      if(parsed&&Array.isArray(parsed.tasks))data.tasks=parsed.tasks;
      if(parsed&&parsed.statuses&&typeof parsed.statuses==='object')data.statuses=parsed.statuses;
      if(parsed&&parsed.petState&&typeof parsed.petState==='object')data.petState=parsed.petState;
      if(parsed&&parsed.morale&&typeof parsed.morale==='object')data.morale=parsed.morale;
    }catch(e){console.warn('Office data could not be loaded',e);}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){console.warn('Office data could not be saved',e);}}
  function statusOf(id){return data.statuses[id]||'idle';}
  function petOf(p){return Object.assign({},p,data.petState[p.id]||{});}
  function moraleOf(id){return Math.max(0,Math.min(100,Number(data.morale[id]??75)));}
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
  function renderAgents(){
    $('officeTeamCount').textContent=String(agents.length).padStart(2,'0');
    $('officeAgents').innerHTML=agents.map(a=>{
      const working=statusOf(a.id)==='working';
      const slacking=slackingAgentId===a.id&&!working;
      const morale=moraleOf(a.id);return '<button type="button" class="office-agent" data-office-agent="'+a.id+'"><span class="office-agent-avatar">'+a.emoji+'</span><span class="office-agent-info"><strong>'+a.name+'</strong><small>'+a.role+'</small><span class="office-morale"><i style="width:'+morale+'%"></i></span></span><span class="office-agent-status '+(working?'working':slacking?'slacking':'')+'">'+(working?'กำลังทำงาน':slacking?'แอบอู้':'ว่าง')+'</span></button>';
    }).join('');
    $('officeTaskAgent').innerHTML=agents.map(a=>'<option value="'+a.id+'">'+a.name+' — '+a.role+'</option>').join('');
  }
  function lineFor(agent){
    const working=statusOf(agent.id)==='working';
    if(working){
      const workLines={
        manager:['กำลังจัดคิวงานให้ทุกคนค่ะ','เช็กความคืบหน้าทีมอยู่ค่ะ'],
        researcher:['กำลังค้นข้อมูลอยู่!','เจอข้อมูลน่าสนใจแล้ว'],
        writer:['กำลังร่างข้อความให้อยู่นะ','ขอเกลาประโยคอีกนิด'],
        designer:['กำลังจัดเลย์เอาต์อยู่','เลือกสีให้เข้ากันก่อนนะ'],
        analyst:['กำลังเช็กตัวเลขอยู่','กำลังสรุปข้อมูลให้ CEO'],
        secretary:['กำลังจัดตารางนัดหมาย','กำลังอัปเดตเช็กลิสต์ค่ะ']
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
        secretary:['แอบไถมือถือแป๊บนึงค่ะ','ขอเติมกาแฟก่อนนะ CEO']
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
    const female=['manager','writer','secretary'].includes(a.id);
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
      const slacking=slackingAgentId===a.id&&!working;
      const line=(bubbleAgentId===a.id&&bubbleLine)?bubbleLine:lineFor(a);
      const positions=[
        {x:37,y:41},{x:63,y:37},{x:25,y:58},{x:46,y:67},{x:56,y:73},{x:72,y:59}
      ];
      const pos=positions[i];
      const activityClass=working?'is-working':slacking?'is-slacking':'is-idle';
      const workProp=working?{
        manager:'📋',researcher:'🔎',writer:'⌨️',designer:'🎨',analyst:'📊',secretary:'🗂️'
      }[a.id]:'';
      const bubble=bubbleAgentId===a.id&&bubbleLine?'<span class="office-mini-bubble">'+safeText(bubbleLine.text)+'</span>':'';
      const action=working?'<span class="office-work-prop">'+workProp+'</span>':slacking?'<span class="office-loaf-prop">💤</span>':'';
      return '<button type="button" class="office-sprite '+activityClass+' role-'+a.id+'" data-agent-id="'+a.id+'" style="left:'+pos.x+'%;top:'+pos.y+'%" title="คุยกับ '+safeText(a.name)+'"><span class="office-expression">'+line.face+'</span>'+bubble+'<span class="office-avatar">'+pixelCharacter(a,line.face)+'</span>'+action+'<span class="office-name">'+a.name+'</span><span class="office-role-tag">'+({manager:'หัวหน้าทีม',researcher:'วิจัย',writer:'เขียน',designer:'ออกแบบ',analyst:'วิเคราะห์',secretary:'ธุรการ'}[a.id])+'</span></button>';
    }).join('');
    const petSprites='<div class="office-pet-sprite cat" title="มะลิ แมวประจำออฟฟิศ">🐈</div><div class="office-pet-sprite dog" title="โมจิ น้องหมาประจำออฟฟิศ">🐕</div><div class="office-pet-sprite bird" title="จิ๊บจิ๊บ นกประจำออฟฟิศ">🦜</div>';
    $('officeSprites').innerHTML=zoneLabels+people+petSprites;
  }
  function renderPets(){
    const host=$('officePets'); if(!host)return;
    host.innerHTML=pets.map(p=>{
      const s=petOf(p);
      return '<article class="office-pet"><span class="office-pet-face">'+p.emoji+'</span><strong>'+p.name+' · '+p.kind+'</strong><small>'+safeText(s.mood)+'</small><div class="office-pet-actions"><button type="button" data-pet-action="feed" data-pet="'+p.id+'">🍎 ให้อาหาร</button><button type="button" data-pet-action="play" data-pet="'+p.id+'">🎾 เล่นด้วย</button></div></article>';
    }).join('');
  }
  function renderTasks(){
    const list=$('officeTaskList');
    if(!data.tasks.length){list.innerHTML='<div class="office-empty">ยังไม่มีงานในออฟฟิศ ✦<br>เริ่มมอบหมายงานแรกให้ทีมได้เลย</div>';return;}
    list.innerHTML=data.tasks.slice().sort((a,b)=>b.created-a.created).map(t=>{
      const agent=agents.find(a=>a.id===t.agent),done=t.status==='done';
      return '<article class="office-task"><div class="office-task-head"><h4>'+safeText(t.title)+'</h4><span class="office-task-state '+(done?'done':'')+'">'+(done?'เสร็จแล้ว':'กำลังดำเนินการ')+'</span></div><p>'+safeText(t.detail||'ไม่มีรายละเอียดเพิ่มเติม')+'</p><div class="office-task-meta"><span>ผู้รับผิดชอบ: '+safeText(agent?agent.name:'ทีม')+'</span><span>'+new Date(t.created).toLocaleDateString('th-TH')+'</span></div><div class="office-task-actions">'+(done?'':'<button type="button" data-office-done="'+t.id+'">✓ ทำงานเสร็จแล้ว</button>')+'<button type="button" data-office-delete="'+t.id+'">ลบงาน</button></div></article>';
    }).join('');
  }
  function render(){renderStats();renderAgents();renderSprites();renderPets();renderTasks();}
  function addTask(event){
    event.preventDefault();
    const title=$('officeTaskTitle').value.trim();if(!title)return;
    const agentId=$('officeTaskAgent').value;
    data.tasks.push({id:'office_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),title,detail:$('officeTaskDetail').value.trim(),agent:agentId,status:'doing',created:Date.now()});
    data.statuses[agentId]='working';if(slackingAgentId===agentId)slackingAgentId=null;data.morale[agentId]=Math.min(100,moraleOf(agentId)+2);save();render();$('officeTaskForm').reset();$('officeTaskTitle').focus();
  }
  function completeTask(id){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    task.status='done';
    if(slackingAgentId===task.agent)slackingAgentId=null;
    data.morale[task.agent]=Math.min(100,moraleOf(task.agent)+5);
    if(!data.tasks.some(t=>t.agent===task.agent&&t.status==='doing'))data.statuses[task.agent]='idle';
    save();render();
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
    if(action==='feed'){s.hunger=Math.min(100,(s.hunger||50)+24);s.mood='อิ่มท้องแล้ว ขอบคุณนะ';}
    if(action==='play'){s.joy=Math.min(100,(s.joy||50)+22);s.mood='มีความสุขสุด ๆ';}
    data.petState[id]={hunger:s.hunger,joy:s.joy,mood:s.mood};save();renderPets();
  }
  function init(){
    if(initialized||!$('officeApp'))return;
    initialized=true;load();render();
    if(speechTimer)clearInterval(speechTimer);
    showDialogue(agents[0]);
    speechTimer=setInterval(refreshDialogue,6200);
    if(loafTimer)clearInterval(loafTimer);
    loafTimer=setInterval(cycleLoafing,9000);
    $('officeTaskForm').addEventListener('submit',addTask);
    $('officeTaskList').addEventListener('click',e=>{
      const done=e.target.closest('[data-office-done]'),del=e.target.closest('[data-office-delete]');
      if(done)completeTask(done.getAttribute('data-office-done'));
      if(del)deleteTask(del.getAttribute('data-office-delete'));
    });
    $('officeAgents').addEventListener('click',e=>{
      const btn=e.target.closest('[data-office-agent]');if(btn){const id=btn.getAttribute('data-office-agent');$('officeTaskAgent').value=id;const agent=agents.find(a=>a.id===id);bubbleAgentId=id;bubbleLine=lineFor(agent);showDialogue(agent,bubbleLine);renderSprites();}
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
  window.MyLifePlannerOffice={init,render,ceoCommand};
})();
