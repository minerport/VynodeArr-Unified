import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentMatches,posterVariableValues,renderOverlaySvg,resolveOverlayTemplate,sanitizeOverlayAssignment,sanitizeOverlayLayer,sanitizeOverlayTemplate} from '../packages/platform/src/poster-overlay-service.js';

test('poster overlay inputs are bounded and unsafe SVG content is escaped',()=>{
  const template=sanitizeOverlayTemplate({name:'<script>alert(1)</script>',domain:'movie',plexBadges:{monitored:true,availability:'yes'},layers:[{variable:'title',position:'custom',x:-12,y:500,width:9,fontSize:999,fontFamily:'serif',fontWeight:900,textAlign:'center',textOpacity:2,backgroundOpacity:-1,padding:99,borderRadius:99,foreground:'red',background:'#123456',prefix:'<',suffix:'>'}]});
  const layer=template.layers[0];
  assert.equal(layer.fontSize,96);assert.equal(layer.foreground,'#ffffff');assert.equal(layer.x,0);assert.equal(layer.y,96);assert.equal(layer.width,15);assert.equal(layer.textOpacity,1);assert.equal(layer.backgroundOpacity,0);assert.equal(layer.padding,30);assert.equal(layer.borderRadius,50);
  assert.deepEqual(template.plexBadges,{monitored:true,availability:false,cutoff:false,rating:false});
  const svg=renderOverlaySvg({poster:Buffer.from('image'),template,item:{id:'movie_1',title:'<script>alert(2)</script>'}}).toString();
  assert.doesNotMatch(svg,/<script>/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/data:image\/jpeg;base64/);assert.match(svg,/font-family="Georgia, Times New Roman, serif"/);assert.match(svg,/font-weight="900"/);assert.match(svg,/text-anchor="middle"/);assert.match(svg,/fill-opacity="0"/);
});

test('full-width poster layers anchor consistently and retain adaptive contrast',()=>{
  const layer=sanitizeOverlayLayer({variable:'resolution',position:'custom',x:42,width:100,posterAware:true});
  assert.equal(layer.width,100);assert.equal(layer.x,0);assert.equal(layer.posterAware,true);
});

test('media icon layers are valid variables and render into composed artwork',()=>{
  const template=sanitizeOverlayTemplate({domain:'movie',layers:[{variable:'icon',label:'movie',width:20}]});
  assert.equal(template.layers[0].kind,'icon');assert.equal(template.layers[0].variable,'custom_text');assert.equal(template.layers[0].iconName,'movie');
  const svg=renderOverlaySvg({poster:Buffer.from('poster'),template,item:{title:'Movie'}}).toString();
  assert.match(svg,/M4 6h16v12H4z/);assert.match(svg,/<path/);
});

test('icons and shapes retain their layer kind while carrying media variables',()=>{
  const template=sanitizeOverlayTemplate({layers:[{kind:'icon',iconName:'resolution',iconColor:'#12abef',iconSize:45,contentGap:36,variable:'resolution',contentPosition:'below',shape:'pill'},{kind:'shape',shape:'tag',variable:'rating',contentPosition:'inside',height:24}]});
  assert.equal(template.layers[0].kind,'icon');assert.equal(template.layers[0].variable,'resolution');assert.equal(template.layers[0].iconName,'resolution');
  assert.equal(template.layers[0].shape,'pill');assert.equal(template.layers[0].iconColor,'#12abef');assert.equal(template.layers[0].iconSize,45);assert.equal(template.layers[0].contentGap,36);
  assert.equal(template.layers[1].kind,'shape');assert.equal(template.layers[1].variable,'rating');
  assert.equal(template.layers[1].height,24);
  const svg=renderOverlaySvg({poster:Buffer.from('poster'),template,item:{title:'Movie',quality:'2160p HDR',rating:8.7}}).toString();
  assert.match(svg,/2160p/);assert.match(svg,/8\.7/);assert.match(svg,/M4 9V4h5/);
});

test('variable-aware icon and shape layers do not render without their media value',()=>{
  const poster=Buffer.from('poster');
  const template=sanitizeOverlayTemplate({layers:[
    {kind:'shape',shape:'tag',variable:'rating',contentPosition:'inside',background:'#ff0000'},
    {kind:'icon',iconName:'resolution',variable:'resolution',contentPosition:'below',foreground:'#00ff00'},
    {kind:'shape',shape:'pill',variable:'custom_text',label:'',background:'#0000ff'},
  ]});
  const absent=renderOverlaySvg({poster,template,item:{title:'No metadata'}}).toString();
  assert.doesNotMatch(absent,/#ff0000|#00ff00/);
  assert.match(absent,/#0000ff/);
  const present=renderOverlaySvg({poster,template,item:{title:'Metadata',rating:8.5,quality:'2160p'}}).toString();
  assert.match(present,/#ff0000|#00ff00/);
  assert.match(present,/>8\.5<|>2160p</);
});

test('overlay text can shrink or wrap into bounded lines',()=>{
  const poster=Buffer.from('poster'),item={title:'A Very Long Custom Library Title That Needs Room'};
  const wrapped=sanitizeOverlayTemplate({layers:[{variable:'title',textFit:'wrap',maxLines:3,width:20}]});
  assert.equal(wrapped.layers[0].textFit,'wrap');assert.equal(wrapped.layers[0].maxLines,3);
  assert.match(renderOverlaySvg({poster,template:wrapped,item}).toString(),/<tspan[^>]*>.*<\/tspan>/);
  const shrunk=sanitizeOverlayTemplate({layers:[{variable:'title',textFit:'shrink',fontSize:80,width:15}]});
  const svg=renderOverlaySvg({poster,template:shrunk,item}).toString(),size=Number(svg.match(/font-size="([\d.]+)"/)?.[1]);
  assert.ok(size>=12&&size<80,size);
});

test('poster layer shapes are sanitized and composed into matching SVG geometry',()=>{
  const template=sanitizeOverlayTemplate({layers:[{variable:'title',shape:'tag',label:'Title'}]});
  assert.equal(template.layers[0].shape,'tag');
  assert.match(renderOverlaySvg({poster:Buffer.from('poster'),template,item:{title:'Movie'}}).toString(),/<polygon points=/);
  assert.equal(sanitizeOverlayLayer({shape:'unsafe'}).shape,'rounded');
});

test('specific poster assignments override broad assignments without changing unmatched items',()=>{
  const broad=sanitizeOverlayTemplate({id:'overlay_broad',name:'Broad',layers:[{variable:'year'}]}),specific=sanitizeOverlayTemplate({id:'overlay_specific',name:'Specific',layers:[{variable:'rating'}]});
  const assignments=[sanitizeOverlayAssignment({id:'assignment_all',templateId:broad.id,scope:{type:'all',domain:'movie'}}),sanitizeOverlayAssignment({id:'assignment_item',templateId:specific.id,scope:{type:'items',domain:'movie',mediaIds:['movie_7']}})];
  assert.equal(resolveOverlayTemplate({id:'movie_7'},'movie',[broad,specific],assignments)?.id,specific.id);
  assert.equal(resolveOverlayTemplate({id:'series_7'},'tv',[broad,specific],assignments),null);
  assert.equal(assignmentMatches(assignments[1],{id:'movie_8'},{domain:'movie'}),false);
});

test('poster variables derive friendly values from library metadata',()=>{
  const values=posterVariableValues({title:'Example',rating:8.84,quality:'WEBDL-1080p',runtimeMinutes:120,genres:['Drama'],monitoring:'all',state:'available',tmdbId:42});
  assert.equal(values.rating,'8.8');assert.equal(values.resolution,'1080p');assert.equal(values.runtime,'120 min');assert.equal(values.monitored,'Monitored');assert.equal(values.tmdb_id,42);
});

test('television overlays show the next episode or fall back to series status',()=>{
  const now='2026-08-02T12:00:00Z',upcoming=posterVariableValues({status:'continuing',nextEpisode:{airDateUtc:'2026-08-08T01:00:00Z'}},{now}),ended=posterVariableValues({status:'ended',nextEpisode:null},{now}),past=posterVariableValues({status:'continuing',nextEpisode:{airDateUtc:'2026-07-29T01:00:00Z'}},{now});
  assert.equal(upcoming.next_episode,'Next episode in 6 days');assert.equal(upcoming.series_status,'Continuing');assert.equal(upcoming.next_episode_or_status,'Next episode in 6 days');
  assert.equal(ended.next_episode,'');assert.equal(ended.next_episode_or_status,'Ended');assert.equal(past.next_episode_or_status,'Continuing');
});

test('custom text layers render administrator text without requiring media metadata',()=>{
  const template=sanitizeOverlayTemplate({name:'Custom',layers:[{variable:'custom_text',label:'HOUSE FAVORITE',position:'top-center'}]}),svg=renderOverlaySvg({poster:Buffer.from('image'),template,item:{id:'movie_1'}}).toString();
  assert.match(svg,/HOUSE FAVORITE/);assert.ok(posterVariableValues({}).custom_text==='');
});
