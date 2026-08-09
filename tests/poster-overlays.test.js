import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateOverlayFileMetadata,assignmentMatches,posterVariableValues,renderOverlaySvg,resolveConditionalOverlayLayer,resolveOverlayTemplate,sanitizeOverlayAssignment,sanitizeOverlayLayer,sanitizeOverlayTemplate} from '../packages/platform/src/poster-overlay-service.js';

test('poster overlay inputs are bounded and unsafe SVG content is escaped',()=>{
  const template=sanitizeOverlayTemplate({name:'<script>alert(1)</script>',domain:'movie',plexBadges:{monitored:true,availability:'yes'},layers:[{variable:'title',position:'custom',x:-12,y:500,width:9,fontSize:999,fontFamily:'serif',fontWeight:900,textAlign:'center',textOpacity:2,backgroundOpacity:-1,padding:99,borderRadius:99,foreground:'red',background:'#123456',prefix:'  <',suffix:'>  '}]});
  const layer=template.layers[0];
  assert.equal(layer.fontSize,96);assert.equal(layer.foreground,'#ffffff');assert.equal(layer.x,0);assert.equal(layer.y,96);assert.equal(layer.width,15);assert.equal(layer.textOpacity,1);assert.equal(layer.backgroundOpacity,0);assert.equal(layer.padding,30);assert.equal(layer.borderRadius,50);
  assert.deepEqual(template.plexBadges,{monitored:true,availability:false,cutoff:false,rating:false});
  assert.equal(template.target,'plex');
  assert.equal(layer.prefix,'  <');assert.equal(layer.suffix,'>  ');
  const svg=renderOverlaySvg({poster:Buffer.from('image'),template,item:{id:'movie_1',title:'<script>alert(2)</script>'}}).toString();
  assert.doesNotMatch(svg,/<script>/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/data:image\/jpeg;base64/);assert.match(svg,/font-family="Georgia, Times New Roman, serif"/);assert.match(svg,/font-weight="900"/);assert.match(svg,/text-anchor="middle"/);assert.match(svg,/xml:space="preserve"/);assert.match(svg,/  &lt;/);assert.match(svg,/&gt;  /);assert.match(svg,/fill-opacity="0"/);
});

test('poster destinations persist and Plex styles do not resolve in the VynodeArr library',()=>{
  const vynode=sanitizeOverlayTemplate({id:'overlay_vynode',target:'vynode',layers:[{variable:'title'}]}),plex=sanitizeOverlayTemplate({id:'overlay_plex',target:'plex',layers:[{variable:'title'}]}),legacy=sanitizeOverlayTemplate({plexBadges:{rating:true},layers:[{variable:'rating'}]});
  assert.equal(vynode.target,'vynode');assert.equal(plex.target,'plex');assert.equal(legacy.target,'plex');
  const assignments=[sanitizeOverlayAssignment({templateId:plex.id,scope:{type:'items',domain:'movie',mediaIds:['movie_7']}}),sanitizeOverlayAssignment({templateId:vynode.id,scope:{type:'all',domain:'movie'}})];
  assert.equal(resolveOverlayTemplate({id:'movie_7'},'movie',[plex,vynode],assignments)?.id,vynode.id);
});

test('Plex overlay SVG can render as a transparent composite with selected live badges',()=>{
  const template=sanitizeOverlayTemplate({target:'plex',plexBadges:{monitored:true,availability:true,cutoff:true,rating:true},layers:[{variable:'title'}]}),svg=renderOverlaySvg({poster:Buffer.from('poster'),template,item:{title:'Movie',monitoring:'all',state:'cutoff',rating:8.4},includePoster:false}).toString();
  assert.doesNotMatch(svg,/<image /);assert.match(svg,/MONITORED/);assert.match(svg,/AVAILABLE/);assert.match(svg,/CUTOFF UNMET/);assert.match(svg,/8\.4/);assert.match(svg,/DejaVu Sans/);
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

test('wrapped overlay height follows rendered lines instead of the maximum line allowance',()=>{
  const template=sanitizeOverlayTemplate({layers:[{variable:'genres',textFit:'wrap',maxLines:6,width:100,fontSize:32,padding:12,background:'#ff0000'}]}),single=renderOverlaySvg({poster:Buffer.from('poster'),template,item:{genres:['Thriller','Drama','Horror']}}).toString(),many=renderOverlaySvg({poster:Buffer.from('poster'),template,item:{genres:['A very long genre value that must wrap across multiple actual lines on a narrow poster layer']}}).toString(),height=value=>Number(value.match(/<rect x="0" y="[^"]+" width="600" height="([^"]+)"/)?.[1]);
  assert.ok(height(single)<100,`single-line wrap height was ${height(single)}`);assert.ok(height(many)>height(single));
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

test('VynodeArr assignments can keep one saved style or rotate compatible styles daily',()=>{
  const first=sanitizeOverlayTemplate({id:'template_first',name:'First',target:'vynode',domain:'movie',enabled:true}),second=sanitizeOverlayTemplate({id:'template_second',name:'Second',target:'vynode',domain:'movie',enabled:true});
  const fixed=sanitizeOverlayAssignment({templateId:first.id,presentationMode:'fixed',scope:{type:'all',domain:'movie'}}),rotating=sanitizeOverlayAssignment({templateId:first.id,presentationMode:'rotate',scope:{type:'all',domain:'movie'}});
  assert.equal(resolveOverlayTemplate({id:'movie_10'},'movie',[first,second],[fixed])?.id,first.id);
  assert.ok([first.id,second.id].includes(resolveOverlayTemplate({id:'movie_10'},'movie',[first,second],[rotating])?.id));
  assert.equal(rotating.presentationMode,'rotate');
});

test('poster variables derive friendly values from library metadata',()=>{
  const now='2026-08-02T12:00:00Z',values=posterVariableValues({title:'Example',rating:8.84,quality:'WEBDL-1080p',qualityProfile:'Ultra HD',runtimeMinutes:120,genres:['Drama'],monitoring:'all',state:'available',tmdbId:42,sizeOnDisk:16106127360,completionPercent:100,tags:['favorite','4k'],addedAt:'2026-07-30T12:00:00Z',releaseDate:'2026-07-20T12:00:00Z',queue:{status:'downloading',progress:63,eta:'2026-08-03T12:00:00Z'}},{now});
  assert.equal(values.rating,'8.8');assert.equal(values.resolution,'1080p');assert.equal(values.quality_profile,'Ultra HD');assert.equal(values.runtime,'120 min');assert.equal(values.monitored,'Monitored');assert.equal(values.tmdb_id,42);
  assert.equal(values.file_size,'15 GB');assert.equal(values.completion_percent,'100%');assert.equal(values.tags,'favorite, 4k');assert.equal(values.date_added,'Jul 30');assert.equal(values.added_ago,'3 days ago');assert.equal(values.release_age,'13 days ago');assert.equal(values.download_status,'Downloading');assert.equal(values.download_progress,'63%');assert.equal(values.download_eta,'Tomorrow');assert.equal(values.library_status,'Complete');
});

test('theatrical artwork icons render as editable overlay layers',()=>{
  for(const [iconName,path] of [['filmstrip','M3 5h18v14H3z'],['megaphone','M3 10v4h4'],['popcorn','M6 9h12'],['marquee','M3 6h18v12H3z']]){
    const template=sanitizeOverlayTemplate({layers:[{kind:'icon',iconName,variable:'custom_text',label:'',width:24}]});
    assert.match(renderOverlaySvg({poster:Buffer.from('poster'),template,item:{title:'Movie'}}).toString(),new RegExp(path));
  }
});

test('decorative custom-text artwork does not inherit a visible placeholder label',()=>{
  const shape=sanitizeOverlayLayer({kind:'shape',variable:'custom_text',label:'Custom text',width:40,height:10}),icon=sanitizeOverlayLayer({kind:'icon',variable:'custom_text',label:'',iconName:'filmstrip'});
  assert.equal(shape.label,'');assert.equal(icon.label,'');
  const svg=renderOverlaySvg({poster:Buffer.alloc(0),includePoster:false,template:{enabled:true,layers:[shape,icon]},item:{}}).toString();
  assert.equal(svg.includes('Custom text'),false);
});

test('explicit layer heights resize text and icon artwork in exact output',()=>{
  const template=sanitizeOverlayTemplate({layers:[{kind:'text',variable:'custom_text',label:'COMING SOON',width:70,height:8},{kind:'icon',iconName:'filmstrip',variable:'custom_text',label:'',width:30,height:18}]});
  const svg=renderOverlaySvg({poster:Buffer.from('poster'),template,item:{title:'Movie'}}).toString();
  assert.match(svg,/height="72"/);
  assert.match(svg,/height="162"/);
});

test('overlay groups persist as editor metadata without changing render order',()=>{
  const template=sanitizeOverlayTemplate({layers:[{id:'layer_one',groupId:'group_badge',variable:'title'},{id:'layer_two',groupId:'group_badge',kind:'shape',variable:'custom_text'}]});
  assert.equal(template.layers[0].groupId,'group_badge');
  assert.equal(template.layers[1].groupId,'group_badge');
});

test('poster variables expose Reeltrack collection artwork values',()=>{
  const values=posterVariableValues({collectionName:'Weekend picks',collectionTitleCount:14,collectionMediaType:'Movies',collectionLastSync:'2026-08-08T12:00:00Z'},{now:'2026-08-08T13:00:00Z'});
  assert.equal(values.collection_name,'Weekend picks');assert.equal(values.collection_title_count,14);assert.equal(values.collection_media_type,'Movies');assert.equal(values.collection_last_sync,'Aug 8');
});

test('days since added uses Plex metadata for Plex and library metadata for VynodeArr',()=>{
  assert.equal(posterVariableValues({addedAt:'2020-01-01T00:00:00Z'},{now:'2026-08-07T23:59:00Z',plexAddedAt:'2026-08-01T01:00:00Z'}).plex_days_since_added,6);
  assert.equal(posterVariableValues({addedAt:'2026-08-01T00:00:00Z'},{now:'2026-08-07T12:00:00Z'}).plex_days_since_added,6);
  assert.equal(posterVariableValues({},{now:'2026-08-07T12:00:00Z',plexAddedAt:'2026-08-09T00:00:00Z'}).plex_days_since_added,1);
});

test('file metadata variables and television aggregation strategies are deterministic',()=>{
  const files=[
    {resolution:'2160p',videoCodec:'HEVC',audioCodec:'TrueHD',audioChannels:'7.1',dynamicRange:'Dolby Vision',source:'Blu-ray',languages:['English'],subtitleLanguages:['English','Spanish'],bitrate:42000000,size:20000000000,dateAdded:'2026-08-01T00:00:00Z'},
    {resolution:'1080p',videoCodec:'AVC',audioCodec:'EAC3',audioChannels:'5.1',dynamicRange:'SDR',source:'WEB-DL',languages:['English'],subtitleLanguages:['English'],bitrate:8000000,size:4000000000,dateAdded:'2026-08-02T00:00:00Z'},
    {resolution:'1080p',videoCodec:'AVC',audioCodec:'EAC3',audioChannels:'5.1',dynamicRange:'SDR',source:'WEB-DL',languages:['English'],subtitleLanguages:['English'],bitrate:9000000,size:5000000000,dateAdded:'2026-07-31T00:00:00Z'}
  ];
  assert.equal(aggregateOverlayFileMetadata(files,'most_common').videoCodec,'AVC');assert.equal(aggregateOverlayFileMetadata(files,'best').resolution,'2160p');assert.equal(aggregateOverlayFileMetadata(files,'lowest').resolution,'1080p');assert.equal(aggregateOverlayFileMetadata(files,'latest').bitrate,8000000);assert.equal(aggregateOverlayFileMetadata(files,'mixed').dynamicRange,'Mixed');
  const values=posterVariableValues({fileMetadata:aggregateOverlayFileMetadata(files,'best')});assert.equal(values.video_codec,'HEVC');assert.equal(values.audio_codec,'TrueHD');assert.equal(values.audio_channels,'7.1');assert.equal(values.dynamic_range,'Dolby Vision');assert.equal(values.source,'Blu-ray');assert.equal(values.bitrate,'42.0 Mbps');assert.equal(values.subtitle_languages,'English, Spanish');
});

test('television overlays show the next episode or fall back to series status',()=>{
  const now='2026-08-02T12:00:00Z',upcoming=posterVariableValues({status:'continuing',nextEpisode:{title:'The Return',airDateUtc:'2026-08-08T01:00:00Z'},seasonProgress:'2 / 3',episodeProgress:'18 / 24',completionPercent:75,missingEpisodes:6,cutoffUnmetEpisodes:2,seriesType:'anime',firstAired:'2025-01-04T00:00:00Z'},{now}),ended=posterVariableValues({status:'ended',nextEpisode:null},{now}),past=posterVariableValues({status:'continuing',nextEpisode:{airDateUtc:'2026-07-29T01:00:00Z'}},{now});
  assert.equal(upcoming.next_episode,'Next episode in 6 days');assert.equal(upcoming.series_status,'Continuing');assert.equal(upcoming.next_episode_or_status,'Next episode in 6 days');
  assert.equal(upcoming.next_episode_title,'The Return');assert.equal(upcoming.next_episode_date,'Aug 8');assert.equal(upcoming.next_episode_countdown,'In 6 days');assert.equal(upcoming.episodes_available,18);assert.equal(upcoming.episodes_total,24);assert.equal(upcoming.episode_progress,'18 / 24');assert.equal(upcoming.season_progress,'2 / 3');assert.equal(upcoming.series_type,'Anime');assert.equal(upcoming.cutoff_status,'Cutoff unmet');assert.equal(upcoming.cutoff_unmet_count,2);assert.equal(upcoming.availability,'Available');assert.equal(upcoming.library_status,'Cutoff unmet');
  assert.equal(ended.next_episode,'');assert.equal(ended.next_episode_or_status,'Ended');assert.equal(past.next_episode_or_status,'Continuing');
});

test('season and episode overlay values expose current, next, and latest context',()=>{
  const values=posterVariableValues({seasonCount:4,currentSeason:{seasonNumber:4,progress:'3 / 10',missing:7},nextEpisode:{title:'Tomorrow Again',seasonNumber:4,episodeNumber:4,airDateUtc:'2026-08-08T00:00:00Z'},latestEpisode:{title:'Yesterday Once',seasonNumber:4,episodeNumber:3,airDateUtc:'2026-08-01T00:00:00Z'}},{now:'2026-08-02T12:00:00Z'});
  assert.equal(values.season_count,4);assert.equal(values.current_season,4);assert.equal(values.current_season_progress,'3 / 10');assert.equal(values.current_season_missing,7);assert.equal(values.next_episode_code,'S04E04');assert.equal(values.next_episode_title,'Tomorrow Again');assert.equal(values.next_episode_date,'Aug 8');assert.equal(values.next_episode_season,4);assert.equal(values.next_episode_number,4);assert.equal(values.latest_episode_code,'S04E03');assert.equal(values.latest_episode_title,'Yesterday Once');assert.equal(values.latest_episode_date,'Aug 1');assert.equal(values.latest_episode_season,4);assert.equal(values.latest_episode_number,3);
});

test('overlay layer conditions support AND and OR rules across variables',()=>{
  const base={variable:'title',label:'{title}',conditions:{join:'and',rules:[{variable:'resolution',operator:'equals',value:'2160p'},{variable:'dynamic_range',operator:'contains',value:'hdr'}]}},template={layers:[base]},poster=Buffer.from('poster');
  assert.match(renderOverlaySvg({poster,template,item:{title:'Match',fileMetadata:{resolution:'2160p',dynamicRange:'HDR10'}}}).toString(),/>Match</);
  assert.doesNotMatch(renderOverlaySvg({poster,template,item:{title:'No match',fileMetadata:{resolution:'1080p',dynamicRange:'HDR10'}}}).toString(),/>No match</);
  const either={layers:[{...base,conditions:{...base.conditions,join:'or'}}]};assert.match(renderOverlaySvg({poster,template:either,item:{title:'Either',fileMetadata:{resolution:'1080p',dynamicRange:'HDR10'}}}).toString(),/>Either</);
});

test('conditional style variants override appearance deterministically',()=>{
  const layer=sanitizeOverlayLayer({variable:'title',background:'#111827',foreground:'#ffffff',styleMode:'first',styleRules:[{name:'4K',rank:2,conditions:{join:'and',rules:[{variable:'resolution',operator:'equals',value:'2160p'}]},overrides:{background:'#2563eb'}},{name:'4K HDR',rank:1,conditions:{join:'and',rules:[{variable:'resolution',operator:'equals',value:'2160p'},{variable:'dynamic_range',operator:'contains',value:'HDR'}]},overrides:{background:'#f59e0b',foreground:'#000000',shape:'pill',fontSize:54,fontFamily:'condensed',fontWeight:900,textAlign:'center',textTransform:'uppercase',padding:18,borderRadius:24}}]});
  const values={resolution:'2160p',dynamic_range:'HDR10'},resolved=resolveConditionalOverlayLayer(layer,values);assert.equal(layer.styleRules[0].name,'4K HDR');assert.equal(layer.styleRules[0].rank,1);assert.equal(resolved.background,'#f59e0b');assert.equal(resolved.foreground,'#000000');assert.equal(resolved.shape,'pill');assert.equal(resolved.fontSize,54);assert.equal(resolved.fontFamily,'condensed');assert.equal(resolved.fontWeight,900);assert.equal(resolved.textAlign,'center');assert.equal(resolved.textTransform,'uppercase');assert.equal(resolved.padding,18);assert.equal(resolved.borderRadius,24);
  const svg=renderOverlaySvg({poster:Buffer.from('poster'),template:{layers:[layer]},item:{title:'Premium',fileMetadata:{resolution:'2160p',dynamicRange:'HDR10'}}}).toString();assert.match(svg,/#f59e0b/);assert.match(svg,/#000000/);
  const merged=resolveConditionalOverlayLayer({...layer,styleMode:'merge'},values);assert.equal(merged.background,'#2563eb');assert.equal(merged.foreground,'#000000');
});

test('ranked Plex age ranges use inclusive numeric boundaries',()=>{
  const layer=sanitizeOverlayLayer({variable:'plex_days_since_added',background:'#111111',styleRules:[
    {name:'0-7',rank:1,conditions:{join:'and',rules:[{variable:'plex_days_since_added',operator:'greater_than_or_equal',value:'0'},{variable:'plex_days_since_added',operator:'less_than_or_equal',value:'7'}]},overrides:{background:'#00ff00'}},
    {name:'8-14',rank:2,conditions:{join:'and',rules:[{variable:'plex_days_since_added',operator:'greater_than_or_equal',value:'8'},{variable:'plex_days_since_added',operator:'less_than_or_equal',value:'14'}]},overrides:{background:'#ffff00'}},
    {name:'15+',rank:3,conditions:{join:'and',rules:[{variable:'plex_days_since_added',operator:'greater_than_or_equal',value:'15'}]},overrides:{background:'#ff0000'}}
  ]});
  assert.equal(resolveConditionalOverlayLayer(layer,{plex_days_since_added:7}).background,'#00ff00');
  assert.equal(resolveConditionalOverlayLayer(layer,{plex_days_since_added:8}).background,'#ffff00');
  assert.equal(resolveConditionalOverlayLayer(layer,{plex_days_since_added:14}).background,'#ffff00');
  assert.equal(resolveConditionalOverlayLayer(layer,{plex_days_since_added:15}).background,'#ff0000');
  assert.equal(resolveConditionalOverlayLayer(layer,{plex_days_since_added:''}).background,'#111111');
});

test('request overlay variables include people, count, and oldest request date',()=>{
  const values=posterVariableValues({title:'Requested title'},{now:'2026-08-02T12:00:00Z',requesters:[{name:'Alex',requestedAt:'2026-07-30T12:00:00Z'},{username:'sam',requestedAt:'2026-08-01T12:00:00Z'}]});
  assert.equal(values.requested_by,'Alex, sam');assert.equal(values.request_count,2);assert.equal(values.requested_date,'Jul 30');assert.equal(values.requested_ago,'3 days ago');
});

test('custom text layers render administrator text without requiring media metadata',()=>{
  const template=sanitizeOverlayTemplate({name:'Custom',layers:[{variable:'custom_text',label:'HOUSE FAVORITE',position:'top-center'}]}),svg=renderOverlaySvg({poster:Buffer.from('image'),template,item:{id:'movie_1'}}).toString();
  assert.match(svg,/HOUSE FAVORITE/);assert.ok(posterVariableValues({}).custom_text==='');
});
