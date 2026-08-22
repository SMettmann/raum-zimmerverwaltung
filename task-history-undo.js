/* RAUMWERK Aufgabenhistorie – erledigte Aufgaben direkt wieder öffnen */
(function(){
  function canUndoTask(){return !window.raumwerkCloud?.user||window.raumwerkCloud.user.role!=='viewer'}

  function taskEventsForUndo(){
    const events=[];
    tasks.forEach(t=>{
      if(Array.isArray(t.history)&&t.history.length){
        t.history.forEach(e=>events.push({...e,taskId:t.id}));
      }else if(t.done){
        events.push({action:'completed',at:t.completedAt||'',taskId:t.id,legacy:true});
      }
    });
    return events.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  }

  function isCurrentCompletion(event){
    const task=tasks.find(t=>t.id===event.taskId);
    if(!task?.done||event.action!=='completed')return false;
    const history=Array.isArray(task.history)?task.history:[];
    if(!history.length)return true;
    const latest=history[history.length-1];
    return latest.action==='completed'&&String(latest.at||'')===String(event.at||'');
  }

  function decorateTaskHistory(){
    const wrap=document.getElementById('taskHistoryList');
    if(!wrap||!canUndoTask())return;
    const rows=[...wrap.querySelectorAll(':scope > .req-row')];
    const visible=taskEventsForUndo().slice(0,rows.length);
    rows.forEach((row,index)=>{
      row.querySelector('.task-history-undo')?.remove();
      const event=visible[index];
      if(!event||!isCurrentCompletion(event))return;
      const actions=document.createElement('div');
      actions.className='req-actions task-history-undo';
      const button=document.createElement('button');
      button.className='btn small';
      button.textContent='Rückgängig';
      button.addEventListener('click',()=>toggleTask(event.taskId));
      actions.appendChild(button);
      row.appendChild(actions);
    });
  }

  if(typeof renderTasks==='function'){
    const baseRenderTasks=renderTasks;
    renderTasks=function(){baseRenderTasks();decorateTaskHistory()};
  }

  if(typeof window.toggleTaskHistoryAll==='function'){
    const baseToggleTaskHistoryAll=window.toggleTaskHistoryAll;
    window.toggleTaskHistoryAll=function(){baseToggleTaskHistoryAll();decorateTaskHistory()};
  }

  decorateTaskHistory();
})();
