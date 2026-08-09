import {createReadStream} from 'node:fs';
import {readdir,stat} from 'node:fs/promises';
import {basename,extname,resolve,sep} from 'node:path';

const types=new Map([['.mp4','video/mp4'],['.m4v','video/mp4'],['.webm','video/webm'],['.mov','video/quicktime']]);
const trailerName=/(?:^|[\s._-])(?:trailer|teaser|preview|featurette)(?:[\s._-]|$)/i;
const trailerFolder=/^(?:trailers?|extras?|featurettes?|previews?)$/i;
const inside=(root,path)=>path!==root&&path.startsWith(`${root}${sep}`);

export class TrailerPlaybackService{
  constructor({movieRoot='/movies',tvRoot='/tv'}={}){this.roots={movie:resolve(movieRoot),tv:resolve(tvRoot)};}
  async find(domain,location){
    const mediaDomain=domain==='tv'?'tv':'movie',root=this.roots[mediaDomain],folder=resolve(String(location||''));
    if(!location||!inside(root,folder))return null;
    const entries=await readdir(folder,{withFileTypes:true}).catch(()=>[]),files=[];
    for(const entry of entries){
      const path=resolve(folder,entry.name);
      if(entry.isFile()&&types.has(extname(entry.name).toLowerCase())&&trailerName.test(entry.name))files.push(path);
      if(entry.isDirectory()&&trailerFolder.test(entry.name)){
        const nested=await readdir(path,{withFileTypes:true}).catch(()=>[]);
        for(const child of nested)if(child.isFile()&&types.has(extname(child.name).toLowerCase()))files.push(resolve(path,child.name));
      }
    }
    if(!files.length&&/\[tmdb-\d+\]/i.test(basename(folder))){
      const videos=entries.filter(entry=>entry.isFile()&&types.has(extname(entry.name).toLowerCase()));
      if(videos.length===1)files.push(resolve(folder,videos[0].name));
    }
    for(const path of files){
      if(!inside(root,path)||!inside(folder,path))continue;
      const details=await stat(path).catch(()=>null);
      if(details?.isFile()&&details.size>0)return{path,size:details.size,contentType:types.get(extname(path).toLowerCase())};
    }
    return null;
  }
  send(req,res,file){
    const common={'accept-ranges':'bytes','cache-control':'private, max-age=300','content-type':file.contentType,'x-content-type-options':'nosniff'},range=String(req.headers.range||'').match(/^bytes=(\d*)-(\d*)$/);
    if(!range){res.writeHead(200,{...common,'content-length':String(file.size)});if(req.method==='HEAD')return res.end();return createReadStream(file.path).pipe(res);}
    let start=range[1]?Number(range[1]):0,end=range[2]?Number(range[2]):file.size-1;
    if(!range[1]&&range[2]){const suffix=Number(range[2]);start=Math.max(0,file.size-suffix);end=file.size-1;}
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=file.size){res.writeHead(416,{...common,'content-range':`bytes */${file.size}`});return res.end();}
    end=Math.min(end,file.size-1);res.writeHead(206,{...common,'content-length':String(end-start+1),'content-range':`bytes ${start}-${end}/${file.size}`});if(req.method==='HEAD')return res.end();return createReadStream(file.path,{start,end}).pipe(res);
  }
}
