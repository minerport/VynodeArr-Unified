import { readdir,stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory=resolve('apps/web/public/react');
let files;
try{files=await readdir(directory);}catch(error){
  if(error?.code==='ENOENT'){
    console.error('Web bundle budget requires a completed web build. Run npm run build:web first.');
    process.exit(1);
  }
  throw error;
}
const sizes=await Promise.all(files.map(async name=>({name,bytes:(await stat(resolve(directory,name))).size})));
const entry=sizes.find(file=>file.name==='vynodearr-react.js');
const routeChunks=sizes.filter(file=>file.name.endsWith('.js')&&file.name!=='vynodearr-react.js');
const stylesheet=sizes.find(file=>file.name==='vynodearr-react.css');
const limits={entry:300_000,route:45_000,css:50_000};
const failures=[];

if(!entry)failures.push('The React entry bundle was not produced.');
else if(entry.bytes>limits.entry)failures.push(`React entry is ${entry.bytes} bytes (limit ${limits.entry}).`);
for(const chunk of routeChunks)if(chunk.bytes>limits.route)failures.push(`${chunk.name} is ${chunk.bytes} bytes (route limit ${limits.route}).`);
if(stylesheet&&stylesheet.bytes>limits.css)failures.push(`React stylesheet is ${stylesheet.bytes} bytes (limit ${limits.css}).`);

if(failures.length){
  console.error(`Web bundle budget failed:\n- ${failures.join('\n- ')}`);
  process.exitCode=1;
}else{
  const largest=[...routeChunks].sort((a,b)=>b.bytes-a.bytes)[0];
  console.log(`Web bundle budget passed: entry ${entry?.bytes||0} bytes; largest route ${largest?.name||'none'} ${largest?.bytes||0} bytes.`);
}
