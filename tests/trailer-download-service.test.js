import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PassThrough} from 'node:stream';
import test from 'node:test';
import {TrailerDownloadService,sanitizeTrailerUrl} from '../packages/platform/src/trailer-download-service.js';

const fakeSpawn=(calls,output='/trailers/Movie/Movie - Trailer.mp4')=>(binary,args)=>{calls.push({binary,args});const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};queueMicrotask(()=>{child.stdout.end(args[0]==='--version'?'2026.08.01\n':`${output}\n`);child.stderr.end();child.emit('close',0)});return child;};

test('trailer downloader reports yt-dlp and builds a bounded official trailer command',async()=>{const calls=[],root=await mkdtemp(join(tmpdir(),'vynodearr-trailers-')),service=new TrailerDownloadService({root,spawnImpl:fakeSpawn(calls)}),status=await service.status(),result=await service.download({url:'https://www.youtube.com/watch?v=abc',title:'A Movie',year:2026,domain:'movie',tmdbId:42});assert.equal(status.available,true);assert.equal(status.version,'2026.08.01');assert.equal(result.tmdbId,42);assert.match(result.folder,/A Movie \(2026\) \[tmdb-42\]$/);assert.deepEqual(calls[1].args.slice(0,4),['--no-playlist','--no-overwrites','--max-filesize','1G']);assert.ok(calls[1].args.includes('bv*[height<=1080]+ba/b[height<=1080]'));assert.equal(calls[1].args.at(-1),'https://www.youtube.com/watch?v=abc');});
test('trailer downloader rejects untrusted and non-HTTPS sources',()=>{assert.throws(()=>sanitizeTrailerUrl('http://youtube.com/watch?v=x'),/trusted/);assert.throws(()=>sanitizeTrailerUrl('https://example.com/video'),/trusted/);});
test('trailer cleanup is confined to the managed staging root',async()=>{const root=await mkdtemp(join(tmpdir(),'vynodearr-trailers-')),service=new TrailerDownloadService({root}),folder=join(root,'Managed Trailer');await (await import('node:fs/promises')).mkdir(folder);await service.remove({folder});await assert.rejects(access(folder));await assert.rejects(service.remove({folder:join(root,'..','outside')}),/outside/);});
