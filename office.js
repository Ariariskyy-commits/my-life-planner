/* MY LIFE PLANNER — isolated virtual office simulation.
   This module intentionally uses its own localStorage namespace and does not touch planner/Firebase state.
   AI execution is not implemented here; connect a secured backend before enabling real agent output. */
(() => {
  'use strict';
  const KEY = 'myLifePlanner_virtualOffice_v1';
  const agents = [
    {id:'manager',name:'Mika',role:'Manager · ผู้จัดการ',emoji:'👩🏻‍💼',desk:'desk-b',x:54,y:44},
    {id:'researcher',name:'Nori',role:'Researcher · นักค้นคว้า',emoji:'🧑🏻‍🔬',desk:'desk-b',x:67,y:50},
    {id:'writer',name:'Momo',role:'Writer · นักเขียน',emoji:'👩🏻‍🎨',desk:'desk-a',x:29,y:52},
    {id:'designer',name:'Kiki',role:'Designer · นักออกแบบ',emoji:'🧑🏼‍🎨',desk:'desk-a',x:38,y:61},
    {id:'analyst',name:'Theo',role:'Analyst · นักวิเคราะห์',emoji:'👨🏻‍💻',desk:'desk-c',x:48,y:76},
    {id:'secretary',name:'Pim',role:'Secretary · เลขานุการ',emoji:'👩🏻‍💻',desk:'desk-c',x:60,y:78}
  ];
  const $ = id => document.getElementById(id);
  let data = {tasks:[], statuses:{}};
  let initialized = false;
  const safeText = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (parsed && Array.isArray(parsed.tasks)) data.tasks = parsed.tasks;
      if (parsed && parsed.statuses && typeof parsed.statuses === 'object') data.statuses = parsed.statuses;
    } catch (e) { console.warn('Office data could not be loaded', e); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.warn('Office data could not be saved', e); }
  }
  function statusOf(id) { return data.statuses[id] || 'idle'; }
  function renderStats() {
    const active = agents.filter(a => statusOf(a.id) === 'working').length;
    const done = data.tasks.filter(t => t.status === 'done').length;
    $('officeStats').innerHTML = [
      ['TEAM MEMBERS',agents.length,'fa-users'],
      ['ON THE CLOCK',active,'fa-laptop'],
      ['TASKS COMPLETED',done,'fa-check-circle']
    ].map(x => '<div class="office-stat"><small><i class="fa-solid '+x[2]+'"></i> '+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');
  }
  function renderAgents() {
    $('officeTeamCount').textContent = String(agents.length).padStart(2,'0');
    $('officeAgents').innerHTML = agents.map(a => {
      const working = statusOf(a.id) === 'working';
      return '<button type="button" class="office-agent" data-office-agent="'+a.id+'"><span class="office-agent-avatar">'+a.emoji+'</span><span class="office-agent-info"><strong>'+a.name+'</strong><small>'+a.role+'</small></span><span class="office-agent-status '+(working?'working':'')+'">'+(working?'WORKING':'AVAILABLE')+'</span></button>';
    }).join('');
    $('officeTaskAgent').innerHTML = agents.map(a => '<option value="'+a.id+'">'+a.name+' — '+a.role.split(' · ')[0]+'</option>').join('');
  }
  function renderSprites() {
    $('officeSprites').innerHTML = agents.map((a,i) => {
      const working = statusOf(a.id) === 'working';
      const task = data.tasks.find(t => t.agent === a.id && t.status === 'doing');
      const pos = working ? [{x:54,y:46},{x:67,y:50},{x:29,y:54},{x:38,y:62},{x:48,y:76},{x:60,y:78}][i] : {x:a.x,y:a.y};
      return '<div class="office-sprite '+(working?'is-working':'')+'" style="left:calc('+pos.x+'% - 25px);top:calc('+pos.y+'% - 20px)" title="'+safeText(a.name+(task?' · '+task.title:''))+'"><span class="office-avatar">'+a.emoji+'</span><span class="office-name">'+a.name+'</span></div>';
    }).join('');
  }
  function renderTasks() {
    const list = $('officeTaskList');
    if (!data.tasks.length) { list.innerHTML = '<div class="office-empty">ยังไม่มีงานในออฟฟิศ ✦<br>เริ่มมอบหมายงานแรกให้ทีมได้เลย</div>'; return; }
    list.innerHTML = data.tasks.slice().sort((a,b)=>b.created-a.created).map(t => {
      const agent = agents.find(a=>a.id===t.agent);
      const done = t.status === 'done';
      return '<article class="office-task"><div class="office-task-head"><h4>'+safeText(t.title)+'</h4><span class="office-task-state '+(done?'done':'')+'">'+(done?'COMPLETED':'SIMULATION')+'</span></div><p>'+safeText(t.detail || 'ไม่มีรายละเอียดเพิ่มเติม')+'</p><div class="office-task-meta"><span>'+safeText(agent?agent.name:'ทีม')+'</span><span>'+new Date(t.created).toLocaleDateString('th-TH')+'</span></div><div class="office-task-actions">'+(done?'':'<button type="button" data-office-done="'+t.id+'">ทำเครื่องหมายว่าเสร็จ</button>')+'<button type="button" data-office-delete="'+t.id+'">ลบงาน</button></div></article>';
    }).join('');
  }
  function render() { renderStats(); renderAgents(); renderSprites(); renderTasks(); }
  function addTask(event) {
    event.preventDefault();
    const title = $('officeTaskTitle').value.trim();
    if (!title) return;
    const agentId = $('officeTaskAgent').value;
    const task = {id:'office_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),title,detail:$('officeTaskDetail').value.trim(),agent:agentId,status:'doing',created:Date.now()};
    data.tasks.push(task);
    data.statuses[agentId] = 'working';
    save(); render();
    $('officeTaskForm').reset();
    $('officeTaskTitle').focus();
  }
  function completeTask(id) {
    const task = data.tasks.find(t=>t.id===id);
    if (!task) return;
    task.status = 'done';
    if (!data.tasks.some(t=>t.agent===task.agent && t.status==='doing')) data.statuses[task.agent] = 'idle';
    save(); render();
  }
  function deleteTask(id) {
    const task = data.tasks.find(t=>t.id===id);
    data.tasks = data.tasks.filter(t=>t.id!==id);
    if (task && !data.tasks.some(t=>t.agent===task.agent && t.status==='doing')) data.statuses[task.agent] = 'idle';
    save(); render();
  }
  function init() {
    if (initialized || !$('officeApp')) return;
    initialized = true; load(); render();
    $('officeTaskForm').addEventListener('submit',addTask);
    $('officeTaskList').addEventListener('click',e=>{
      const done = e.target.closest('[data-office-done]');
      const del = e.target.closest('[data-office-delete]');
      if (done) completeTask(done.getAttribute('data-office-done'));
      if (del) deleteTask(del.getAttribute('data-office-delete'));
    });
    $('officeAgents').addEventListener('click',e=>{
      const btn=e.target.closest('[data-office-agent]');
      if (btn) $('officeTaskAgent').value=btn.getAttribute('data-office-agent');
    });
  }
  document.addEventListener('DOMContentLoaded',init);
  window.addEventListener('load',init);
  window.addEventListener('storage',e=>{if(e.key===KEY){load();render();}});
  window.MyLifePlannerOffice = {init,render};
})();
