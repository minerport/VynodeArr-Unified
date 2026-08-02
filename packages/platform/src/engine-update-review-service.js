const engines={
  movie:{name:'Movie Engine',repository:['Ra','darr'].join('')+'/'+['Ra','darr'].join(''),asset:/linux-musl-core-x64\.tar\.gz$/i},
  tv:{name:'Television Engine',repository:['So','narr'].join('')+'/'+['So','narr'].join(''),asset:/linux-musl-x64\.tar\.gz$/i}
};

const cleanVersion=value=>String(value||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const parts=value=>cleanVersion(value).split('.').map(item=>Number(item)||0);
export function compareEngineVersions(left,right){const a=parts(left),b=parts(right);for(let index=0;index<Math.max(a.length,b.length);index++){if((a[index]||0)!==(b[index]||0))return(a[index]||0)>(b[index]||0)?1:-1;}return 0;}

export class EngineUpdateReviewService{
  constructor({fetcher=globalThis.fetch,versions={},repository='minerport/VynodeArr-Unified'}={}){this.fetcher=fetcher;this.versions=versions;this.repository=repository;this.cache=new Map();}
  async release(domain,{refresh=false}={}){
    const definition=engines[domain];if(!definition)throw new Error('Choose the movie or television engine');
    const cached=this.cache.get(domain);if(!refresh&&cached&&cached.expires>Date.now())return cached.value;
    const response=await this.fetcher(`https://api.github.com/repos/${definition.repository}/releases/latest`,{headers:{accept:'application/vnd.github+json','user-agent':'VynodeArr-Engine-Update-Review'}});
    if(!response?.ok)throw new Error(`${definition.name} release information is temporarily unavailable`);
    const release=await response.json(),asset=(release.assets||[]).find(item=>definition.asset.test(String(item.name||''))),latestVersion=cleanVersion(release.tag_name||release.name);
    if(!latestVersion)throw new Error(`${definition.name} did not publish a recognizable release version`);
    const value={domain,name:definition.name,repository:`https://github.com/${definition.repository}`,installedVersion:cleanVersion(this.versions[domain]),latestVersion,updateAvailable:compareEngineVersions(latestVersion,this.versions[domain])>0,publishedAt:release.published_at||null,releaseUrl:release.html_url||`https://github.com/${definition.repository}/releases`,prerelease:release.prerelease===true,draft:release.draft===true,asset:asset?{name:asset.name,size:Number(asset.size||0),url:asset.browser_download_url}:null};
    this.cache.set(domain,{value,expires:Date.now()+5*60_000});return value;
  }
  async catalog(){const settled=await Promise.allSettled(['movie','tv'].map(domain=>this.release(domain)));return{generatedAt:new Date().toISOString(),mechanism:'Container image rebuild',engines:settled.map((result,index)=>result.status==='fulfilled'?result.value:{domain:index?'tv':'movie',name:index?'Television Engine':'Movie Engine',installedVersion:cleanVersion(this.versions[index?'tv':'movie']),unavailable:true,message:result.reason?.message||'Release information unavailable'})};}
  async review(domain,{validation=null}={}){
    const candidate=await this.release(domain,{refresh:true}),checks=[],add=(id,status,title,message)=>checks.push({id,status,title,message});
    add('stable',candidate.draft||candidate.prerelease?'failed':'passed','Stable upstream release',candidate.draft||candidate.prerelease?'The selected release is a draft or prerelease.':'The release is published as stable.');
    add('asset',candidate.asset?'passed':'failed','Expected Linux archive',candidate.asset?`${candidate.asset.name} matches the installation-managed engine platform.`:'The expected musl x64 archive was not published.');
    const comparison=compareEngineVersions(candidate.latestVersion,candidate.installedVersion);add('direction',comparison<0?'failed':comparison===0?'passed':'passed','Version direction',comparison<0?'The candidate would downgrade the bundled engine.':comparison===0?'The bundled engine already matches this release.':`Upgrade from ${candidate.installedVersion} to ${candidate.latestVersion}.`);
    const domainCheck=validation?.checks?.find(item=>item.id===`${domain}-connection`),storageCheck=validation?.checks?.find(item=>item.id===`${domain}-storage`),dataCheck=validation?.checks?.find(item=>item.id==='application-data');
    add('connection',domainCheck?.status==='healthy'?'passed':domainCheck?'failed':'warning','Current engine health',domainCheck?.message||'Run System Validation before building an update candidate.');
    add('storage',storageCheck?.status==='healthy'?'passed':storageCheck?.status==='failed'?'failed':'warning','Library storage',storageCheck?.message||'Storage readiness has not been validated.');
    add('backup',dataCheck?.status==='healthy'?'passed':'warning','Recovery readiness','Create fresh engine and VynodeArr backups before applying a candidate container.');
    const blocking=checks.some(item=>item.status==='failed'),warnings=checks.some(item=>item.status==='warning'),outcome=blocking?'blocked':warnings?'review':'ready';
    const report={generatedAt:new Date().toISOString(),domain,candidate,outcome,checks,applicationMode:'review-only',nextAction:outcome==='ready'?'Build and test a candidate container in CI; do not replace engine files in place.':'Resolve the reported checks before building a candidate container.'};
    if(outcome!=='ready')report.issueDraft=this.issueDraft(report);return report;
  }
  issueDraft(report){const failed=report.checks.filter(item=>item.status!=='passed'),title=`Engine update review: ${report.candidate.name} ${report.candidate.latestVersion}`,body=[`## Engine update review`,`- Engine: ${report.candidate.name}` ,`- Bundled: ${report.candidate.installedVersion}`,`- Candidate: ${report.candidate.latestVersion}`,`- Outcome: ${report.outcome}`,``,`## Checks`,...failed.map(item=>`- [ ] ${item.title}: ${item.message}`),``,`Generated by VynodeArr ${new Date().toISOString()}. No credentials, hostnames, paths, or API keys are included.`].join('\n');return{title,body,url:`https://github.com/${this.repository}/issues/new?${new URLSearchParams({title,body}).toString()}`};}
  candidatePlan(reports,{baseRef='develop',currentImage='ghcr.io/minerport/vynodearr-unified:2.0.33'}={}){
    if(!Array.isArray(reports)||reports.length!==2||reports.some(report=>report.outcome!=='ready'))throw new Error('Both engine reviews must be ready before preparing a candidate');
    const movie=reports.find(report=>report.domain==='movie'),tv=reports.find(report=>report.domain==='tv');if(!movie||!tv)throw new Error('Movie and television reviews are required');
    if(!movie.candidate.updateAvailable&&!tv.candidate.updateAvailable)throw new Error('The bundled engines already match the reviewed upstream releases');
    return{preparedAt:new Date().toISOString(),workflowUrl:`https://github.com/${this.repository}/actions/workflows/engine-candidate.yml`,workflowInputs:{base_ref:String(baseRef||'develop'),movie_version:movie.candidate.latestVersion,tv_version:tv.candidate.latestVersion,confirmation:'BUILD ENGINE CANDIDATE'},candidateTag:'ghcr.io/minerport/vynodearr-unified:engine-candidate-<workflow-run-id>',rollbackImage:String(currentImage),instructions:['Open the workflow and choose Run workflow.','Enter the exact reviewed inputs shown here.','Wait for verification, image build, and the complete-container smoke test.','Review the published digest before recreating the application container.','Keep the rollback image or digest until post-update validation passes.']};
  }
}
