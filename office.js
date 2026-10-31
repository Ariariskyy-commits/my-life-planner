/* MY LITTLE OFFICE — isolated local simulation.
   No planner/Firebase state is accessed. Real AI execution is intentionally not connected. */
(() => {
  'use strict';
  const KEY = 'myLifePlanner_virtualOffice_v1';
  const agents = [
    {id:'manager',name:'Mika',role:'ผู้จัดการ',emoji:'👩🏻‍💼',x:54,y:44},
    {id:'researcher',name:'Nori',role:'นักค้นคว้า',emoji:'🧑🏻‍🔬',x:67,y:50},
    {id:'writer',name:'Momo',role:'นักเขียน',emoji:'👩🏻‍🎨',x:29,y:52},
    {id:'designer',name:'Kiki',role:'นักออกแบบ',emoji:'🧑🏼‍🎨',x:38,y:61},
    {id:'analyst',name:'Theo',role:'นักวิเคราะห์',emoji:'👨🏻‍💻',x:48,y:76},
    {id:'secretary',name:'Pim',role:'เลขานุการ',emoji:'👩🏻‍💻',x:60,y:78}
  ];
  const pets = [
    {id:'cat',name:'มะลิ',kind:'แมว',emoji:'🐈',mood:'กำลังงีบ',hunger:68,joy:82},
    {id:'dog',name:'โมจิ',kind:'น้องหมา',emoji:'🐕',mood:'อยากเล่น',hunger:55,joy:74},
    {id:'bird',name:'จิ๊บจิ๊บ',kind:'นก',emoji:'🦜',mood:'กำลังร้องเพลง',hunger:76,joy:88}
  ];
  const $ = id => document.getElementById(id);
  let data = {tasks:[],statuses:{},petState:{}};
  let initialized = false;
  let speechTimer = null;
  let dialogueIndex = 0;
  let currentDialogueAgent = 'manager';
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
    }catch(e){console.warn('Office data could not be loaded',e);}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){console.warn('Office data could not be saved',e);}}
  function statusOf(id){return data.statuses[id]||'idle';}
  function petOf(p){return Object.assign({},p,data.petState[p.id]||{});}
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
      return '<button type="button" class="office-agent" data-office-agent="'+a.id+'"><span class="office-agent-avatar">'+a.emoji+'</span><span class="office-agent-info"><strong>'+a.name+'</strong><small>'+a.role+'</small></span><span class="office-agent-status '+(working?'working':'')+'">'+(working?'กำลังทำงาน':'ว่าง')+'</span></button>';
    }).join('');
    $('officeTaskAgent').innerHTML=agents.map(a=>'<option value="'+a.id+'">'+a.name+' — '+a.role+'</option>').join('');
  }
  function lineFor(agent){
    const working=statusOf(agent.id)==='working';
    if(working)return {text:['กำลังลุยงานอยู่! ขอสมาธิแป๊บนะ','รับทราบค่า CEO! กำลังจัดการให้','งานนี้ฉันเอาอยู่ ✨'][Math.floor(Math.random()*3)],mood:'ตั้งใจทำงาน',face:'🤓'};
    const lines=speech[agent.id]||['มีงานอะไรให้ช่วยมั้ย?'];
    const text=lines[Math.floor(Math.random()*lines.length)];
    let mood='อารมณ์ดี',face='😊';
    if(/ว่าง|27 แท็บ|มองแรง|รก|ปัดเศษ/.test(text)){mood='เริ่มเบื่อแล้ว',face='😑';}
    if(/Comic Sans|CEO คะ/.test(text)){mood='แอบหงุดหงิด',face='😤';}
    if(/ไอเดีย|สมองกำลังแล่น|พร้อมแล้ว/.test(text)){mood='ตื่นเต้น',face='🤩';}
    if(/พักบ้าง|งีบ/.test(text)){mood='ง่วงนอน',face='😴';}
    return {text,mood,face};
  }
  function showDialogue(agent){
    if(!agent)return;
    currentDialogueAgent=agent.id;
    const line=lineFor(agent);
    const avatar=$('officeDialogueAvatar'),name=$('officeDialogueName'),mood=$('officeDialogueMood'),text=$('officeDialogueText');
    if(avatar)avatar.textContent=agent.emoji;
    if(name)name.textContent=agent.name+' · '+agent.role;
    if(mood)mood.textContent=line.face+' '+line.mood;
    if(text)text.textContent='“'+line.text+'”';
    const scene=document.querySelectorAll('#officeSprites .office-sprite');
    scene.forEach(el=>el.classList.toggle('is-speaking',el.getAttribute('data-agent-id')===agent.id));
    const bubble=document.querySelector('#officeSprites [data-agent-id="'+agent.id+'"] .office-speech');
    if(bubble)bubble.textContent=line.text;
  }
  function refreshDialogue(){
    const agent=agents[dialogueIndex%agents.length];
    dialogueIndex++;
    showDialogue(agent);
  }
  function renderSprites(){
    const people=agents.map((a,i)=>{
      const working=statusOf(a.id)==='working';
      const line=lineFor(a);
      const pos=working?[{x:54,y:44},{x:67,y:50},{x:29,y:54},{x:38,y:62},{x:48,y:76},{x:60,y:78}][i]:{x:a.x,y:a.y};
      return '<div class="office-sprite '+(working?'is-working':'is-idle')+'" data-agent-id="'+a.id+'" style="left:calc('+pos.x+'% - 34px);top:calc('+pos.y+'% - 34px)" title="'+safeText(a.name+' · '+a.role)+'"><span class="office-speech">'+safeText(line.text)+'</span><span class="office-expression">'+line.face+'</span><span class="office-avatar">'+a.emoji+'</span><span class="office-name">'+a.name+(working?' · ทำงาน':'')+'</span></div>';
    }).join('');
    const petSprites='<div class="office-pet-sprite cat" title="มะลิ แมวประจำออฟฟิศ">🐈</div><div class="office-pet-sprite dog" title="โมจิ น้องหมาประจำออฟฟิศ">🐕</div><div class="office-pet-sprite bird" title="จิ๊บจิ๊บ นกประจำออฟฟิศ">🦜</div>';
    $('officeSprites').innerHTML=people+petSprites;
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
    data.statuses[agentId]='working';save();render();$('officeTaskForm').reset();$('officeTaskTitle').focus();
  }
  function completeTask(id){
    const task=data.tasks.find(t=>t.id===id);if(!task)return;
    task.status='done';
    if(!data.tasks.some(t=>t.agent===task.agent&&t.status==='doing'))data.statuses[task.agent]='idle';
    save();render();
  }
  function deleteTask(id){
    const task=data.tasks.find(t=>t.id===id);data.tasks=data.tasks.filter(t=>t.id!==id);
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
    speechTimer=setInterval(refreshDialogue,5200);
    $('officeTaskForm').addEventListener('submit',addTask);
    $('officeTaskList').addEventListener('click',e=>{
      const done=e.target.closest('[data-office-done]'),del=e.target.closest('[data-office-delete]');
      if(done)completeTask(done.getAttribute('data-office-done'));
      if(del)deleteTask(del.getAttribute('data-office-delete'));
    });
    $('officeAgents').addEventListener('click',e=>{
      const btn=e.target.closest('[data-office-agent]');if(btn){const id=btn.getAttribute('data-office-agent');$('officeTaskAgent').value=id;showDialogue(agents.find(a=>a.id===id));}
    });
    $('officePets').addEventListener('click',e=>{
      const btn=e.target.closest('[data-pet-action]');if(btn)petAction(btn.getAttribute('data-pet'),btn.getAttribute('data-pet-action'));
    });
  }
  document.addEventListener('DOMContentLoaded',init);
  window.addEventListener('load',init);
  window.addEventListener('storage',e=>{if(e.key===KEY){load();render();}});
  window.MyLifePlannerOffice={init,render};
})();
