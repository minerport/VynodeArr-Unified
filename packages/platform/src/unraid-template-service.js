import {access,readFile,readdir,rename,writeFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';

const cleanContainer=value=>String(value||'').trim().replaceAll('\\','/').replace(/\/{2,}/g,'/').replace(/\/$/,'');
const cleanHost=value=>String(value||'').trim().replaceAll('\\','/').replace(/\/{2,}/g,'/').replace(/\/$/,'');
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const assertPath=(value,kind)=>{if(!value.startsWith('/')||value.includes('/../')||value.endsWith('/..')||value.includes('\0'))throw new Error(`${kind} must be an absolute path without parent traversal`);};
const validateDocument=value=>{
  const source=String(value||'');
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('Unsafe XML declarations are not allowed');
  if((source.match(/<Container\b/g)||[]).length!==1||(source.match(/<\/Container>/g)||[]).length!==1||!/<Name>\s*VynodeArr\s*<\/Name>/i.test(source))throw new Error('The selected XML is not the VynodeArr Unraid template');
  const stack=[];for(const match of source.matchAll(/<\/?([A-Za-z][\w:.-]*)\b[^>]*>/g)){const tag=match[1],token=match[0];if(token.startsWith('</')){if(stack.pop()!==tag)throw new Error('The Unraid template XML is malformed');}else if(!token.endsWith('/>'))stack.push(tag);}if(stack.length)throw new Error('The Unraid template XML is malformed');
  return source;
};
const targetPattern=target=>new RegExp(`<Config\\b[^>]*\\bTarget="${target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`,'i');

export class UnraidTemplateService{
  constructor({directory='/unraid-template',templateName='',enabled=true}={}){this.directory=resolve(directory);this.templateName=templateName?basename(templateName):'';this.enabled=enabled;}
  async locate(){if(!this.enabled)return null;const names=await readdir(this.directory).catch(()=>[]),candidates=this.templateName?[this.templateName]:names.filter(name=>/^my-.*\.xml$/i.test(name));const matches=[];for(const name of candidates){const path=join(this.directory,name);if(resolve(path).startsWith(`${this.directory}\\`)||resolve(path).startsWith(`${this.directory}/`)){const source=await readFile(path,'utf8').catch(()=>null);if(source&&/<Name>\s*VynodeArr\s*<\/Name>/i.test(source))matches.push({path,source});}}if(matches.length>1)throw new Error('More than one VynodeArr user template was found');return matches[0]||null;}
  async status(){const found=await this.locate();return{available:Boolean(found),template:found?basename(found.path):null,directory:this.directory};}
  async addMapping(input){const name=String(input.name||'').trim().slice(0,80),domain=input.domain==='tv'?'tv':input.domain==='movie'?'movie':null,hostPath=cleanHost(input.hostPath),containerPath=cleanContainer(input.containerPath);if(!domain)throw new Error('Choose Movies or Television');if(!name)throw new Error('Enter a friendly name');assertPath(hostPath,'Host path');assertPath(containerPath,'Container path');if(!hostPath.startsWith('/mnt/'))throw new Error('The Unraid host path must start with /mnt/');if(['/config','/downloads','/movies','/tv'].includes(containerPath))throw new Error('Choose a new container path; this path is reserved');
    const found=await this.locate();if(!found)throw new Error('Unraid template access is not configured for this container');const before=validateDocument(found.source);if(targetPattern(containerPath).test(before))throw new Error('That container path is already mapped in the Unraid template');
    const label=`Additional ${domain==='movie'?'movie':'television'} library — ${name}`,description=`Additional ${domain==='movie'?'movie':'television'} library managed by the ${name} VynodeArr destination. Apply the container update in Unraid before using it.`;
    const config=`  <Config Name="${xml(label)}" Target="${xml(containerPath)}" Default="${xml(hostPath)}" Mode="rw" Description="${xml(description)}" Type="Path" Display="always" Required="false" Mask="false">${xml(hostPath)}</Config>\n`,after=before.replace('</Container>',`${config}</Container>`);validateDocument(after);if(before.replace(config,'')!==before)throw new Error('The proposed mapping would modify existing template content');
    const temporary=`${found.path}.vynodearr-${process.pid}.tmp`;await writeFile(temporary,after,{encoding:'utf8',mode:0o600,flag:'wx'});const verified=await readFile(temporary,'utf8');validateDocument(verified);if(verified!==after)throw new Error('The staged Unraid template did not verify');await rename(temporary,found.path);return{name,domain,hostPath,containerPath,template:basename(found.path),restartRequired:true};
  }
  async accessible(path){try{await access(cleanContainer(path));return true;}catch{return false;}}
}

export const validateUnraidTemplate=validateDocument;
