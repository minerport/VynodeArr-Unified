export function esc(value:unknown){
  return String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]??char));
}

export function pct(value:unknown){
  return Math.max(0,Math.min(100,Number(value)||0));
}

export function when(value:unknown){
  return formatDateTime(value,'Not scheduled');
}

export function formatDateTime(value:unknown,fallback=''){
  if(!value)return fallback;
  const text=String(value),date=new Date(text);
  return Number.isNaN(date.getTime())?text:new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
}

export function badge(text:unknown,tone=''){
  return `<span class="badge ${tone}">${esc(text)}</span>`;
}

export function formValue(form:HTMLFormElement){
  return Object.fromEntries(new FormData(form).entries());
}

export function mediaPath(root:unknown,current:unknown){
  const base=String(root||'').replace(/[\\/]+$/,'');
  const existing=String(current||'').replace(/[\\/]+$/,'');
  const leaf=existing.split(/[\\/]/).filter(Boolean).at(-1);
  if(!base||!leaf)return existing||base;
  const separator=base.includes('\\')?'\\':'/';
  return `${base}${separator}${leaf}`;
}

export function formatBytes(value:unknown){
  const size=Number(value||0);
  if(!size)return '0 B';
  const units=['B','KB','MB','GB','TB','PB'];
  const index=Math.min(units.length-1,Math.floor(Math.log(size)/Math.log(1024)));
  return `${(size/1024**index).toFixed(index>2?1:0)} ${units[index]}`;
}

export function errorMessage(error:unknown,fallback='VynodeArr could not complete this request.'){
  return error instanceof Error?error.message:fallback;
}

export function releaseEligible(release:Record<string,unknown>|null|undefined){
  const rejections=Array.isArray(release?.rejections)?release.rejections:[];
  return Boolean(release)&&release?.rejected!==true&&release?.approved!==false&&release?.downloadAllowed!==false&&!rejections.length;
}
