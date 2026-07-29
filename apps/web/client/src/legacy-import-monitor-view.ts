import type {ImportJob} from './import-monitor-types';
import {esc} from './shell-utils';

interface LegacyImportMonitorViewOptions{
  host:HTMLElement;
  dismissed:Set<string>;
  persistDismissed:()=>void;
  cancel:(id:string)=>Promise<void>;
  notify:(message:string,tone?:string)=>void;
}

export interface LegacyImportMonitorView{
  render:(jobs:ImportJob[])=>void;
}

export function createLegacyImportMonitorView(options:LegacyImportMonitorViewOptions):LegacyImportMonitorView{
  let collapsed=false;
  const render=(items:ImportJob[])=>{
    const visible=items.filter(job=>!options.dismissed.has(job.id));
    if(!visible.length){options.host.hidden=true;return;}
    const active=visible.filter(job=>job.status==='running'||job.status==='queued').length;
    options.host.hidden=false;
    options.host.classList.toggle('collapsed',collapsed);
    options.host.innerHTML=`<div class="import-progress-heading"><strong>Library imports</strong><span>${active} active</span><button class="text-button toggle-import-panel">${collapsed?'Show':'Minimize'}</button></div><div class="import-job-list">${visible.map(job=>{
      const skipped=Number(job.skipped||0),done=job.completed+job.failed+skipped,percent=Math.round(done/Math.max(1,job.total)*100),finished=['completed','failed'].includes(job.status);
      return `<article class="import-job ${finished?'finished':''}"><div><strong>${esc(job.label)} · ${done}/${job.total}</strong>${finished?`<button class="text-button dismiss-import-job" data-id="${esc(job.id)}">Dismiss</button>`:''}</div><div class="import-job-meter"><span style="width:${percent}%"></span></div><small>${job.currentTitle?esc(job.currentTitle):job.status==='completed'?'Complete':job.status==='failed'?'Import failed':job.status}${skipped?` · ${skipped} already present/skipped`:''}${job.failed?` · ${job.failed} failed`:''}</small>${job.errors?.length?`<details open><summary>${job.errors.length} issue${job.errors.length===1?'':'s'} need attention</summary>${job.errors.map(error=>`<p><strong>${esc(error.title)}</strong><span>${esc(error.message)}</span></p>`).join('')}</details>`:''}</article>`;
    }).join('')}</div>`;
    visible.forEach((job,index)=>{
      const article=options.host.querySelectorAll<HTMLElement>('.import-job')[index],actions=article?.querySelector<HTMLElement>('div');
      if(!actions)return;
      if(['queued','running','canceling'].includes(job.status)){
        const cancel=document.createElement('button');
        cancel.className='text-button cancel-import-job';
        cancel.dataset.id=job.id;
        cancel.textContent=job.status==='canceling'?'Canceling…':'Cancel';
        cancel.disabled=job.status==='canceling';
        actions.append(cancel);
      }else if(job.status==='canceled'&&!actions.querySelector('.dismiss-import-job')){
        article.classList.add('finished');
        const dismiss=document.createElement('button');
        dismiss.className='text-button dismiss-import-job';
        dismiss.dataset.id=job.id;
        dismiss.textContent='Dismiss';
        actions.append(dismiss);
      }
    });
    options.host.querySelector<HTMLButtonElement>('.toggle-import-panel')!.onclick=()=>{collapsed=!collapsed;render(visible);};
    options.host.querySelectorAll<HTMLButtonElement>('.dismiss-import-job').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.id)options.dismissed.add(button.dataset.id);
      options.persistDismissed();
      render(visible);
    }));
    options.host.querySelectorAll<HTMLButtonElement>('.cancel-import-job').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.id;
      if(!id)return;
      button.disabled=true;
      button.textContent='Canceling…';
      try{await options.cancel(id);}
      catch(reason){
        button.disabled=false;
        button.textContent='Cancel';
        options.notify(reason instanceof Error?reason.message:'The import could not be canceled.','error');
      }
    }));
  };
  return {render};
}
