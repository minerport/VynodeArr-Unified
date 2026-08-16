const levels=Object.freeze({debug:10,info:20,warn:30,error:40});
const sensitive=/api[-_]?key|credential|authorization|cookie|password|secret|session|token/i;

const cleanString=value=>String(value)
  .replace(/([?&](?:api(?:key)?|token|auth|password|secret)=)[^&\s]+/gi,'$1[REDACTED]')
  .replace(/((?:api[-_]?key|credential|authorization|cookie|password|secret|token)\s*[=:]\s*)[^\s,;]+/gi,'$1[REDACTED]');

export function redactLogValue(value,key=''){
  if(sensitive.test(key))return '[REDACTED]';
  if(value instanceof Error)return{code:value.code||undefined,message:cleanString(value.safeMessage||value.message||'Operation failed')};
  if(typeof value==='string')return cleanString(value);
  if(Array.isArray(value))return value.slice(0,50).map(item=>redactLogValue(item));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,item])=>typeof item!=='function').map(([name,item])=>[name,redactLogValue(item,name)]));
  return value;
}

const prettyValue=value=>typeof value==='string'&&!/[\s="]/.test(value)?value:JSON.stringify(value);

export function createLogger({env=process.env,context={},sink=console}={}){
  const configured=String(env.VYNODEARR_LOG_LEVEL||'info').toLowerCase(),threshold=levels[configured]??levels.info,format=String(env.VYNODEARR_LOG_FORMAT||'pretty').toLowerCase()==='json'?'json':'pretty';
  const write=(level,event,message='',metadata={})=>{
    if(levels[level]<threshold)return;
    const timestamp=new Date().toISOString(),record=redactLogValue({timestamp,level,event,message,...context,...metadata});
    const method=level==='error'?'error':level==='warn'?'warn':'log';
    if(format==='json')return sink[method](JSON.stringify(record));
    const component=String(record.component||'system').toUpperCase(),text=`${timestamp} ${level.toUpperCase().padEnd(5)} [${component}] ${record.message||record.event}`;
    const details=Object.entries(record).filter(([key,value])=>!['timestamp','level','component','message','event'].includes(key)&&value!==undefined&&value!==null&&value!=='').map(([key,value])=>`${key}=${prettyValue(value)}`).join(' ');
    sink[method](details?`${text} | ${details}`:text);
  };
  const logger={
    debug:(event,message,metadata)=>write('debug',event,message,metadata),
    info:(event,message,metadata)=>write('info',event,message,metadata),
    warn:(event,message,metadata)=>write('warn',event,message,metadata),
    error:(event,message,metadata)=>write('error',event,message,metadata),
    child:metadata=>createLogger({env,context:{...context,...redactLogValue(metadata)},sink})
  };
  return logger;
}
