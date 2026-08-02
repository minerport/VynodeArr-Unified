export type ServiceSection='root-folders'|'library-health'|'media-management'|'poster-overlays'|'profiles'|'custom-formats'|'guide-templates'|'release-profiles'|'indexers'|'download-clients'|'import-lists'|'discover'|'advanced';

const tabs:Array<{section:ServiceSection;label:string;href:string}>=[
  {section:'root-folders',label:'Root Folders',href:'#service/root-folders'},
  {section:'library-health',label:'Library Health',href:'#service/library-health'},
  {section:'media-management',label:'Media Management',href:'#service/media-management'},
  {section:'poster-overlays',label:'Poster Overlays',href:'#service/poster-overlays'},
  {section:'profiles',label:'Quality Profiles',href:'#service/profiles'},
  {section:'custom-formats',label:'Custom Formats',href:'#service/custom-formats'},
  {section:'guide-templates',label:'Guide Templates',href:'#service/guide-templates'},
  {section:'release-profiles',label:'Release Profiles',href:'#service/release-profiles'},
  {section:'indexers',label:'Indexers',href:'#service/indexers'},
  {section:'download-clients',label:'Download Clients',href:'#service/download-clients'},
  {section:'import-lists',label:'Import Lists',href:'#service/import-lists'},
  {section:'discover',label:'Discover',href:'#service/discover'},
  {section:'advanced',label:'Advanced',href:'#management'}
];

export function ServiceTabs({active,onNavigate}:{active:ServiceSection;onNavigate?:(section:ServiceSection)=>void}){
  return <nav className="settings-tabs">{tabs.map(tab=><a className={tab.section===active?'active':undefined} href={tab.href} key={tab.section} onClick={()=>onNavigate?.(tab.section)}>{tab.label}</a>)}</nav>;
}
