import type {SetupCenterSection} from './setup-center-types';

export function SetupNav({active}:{active:SetupCenterSection|'engines'|'storage'|'health'}){
 const sections=[['overview','Overview','#setup'],['engines','Media engines','#setup/engines'],['storage','Storage & destinations','#setup/storage'],['search','Search & downloads','#setup/search'],['integrations','Integrations','#setup/integrations'],['health','Health check','#setup/health']] as const;
 return <><label className="setup-center-mobile-nav"><span>Setup section</span><select value={active} onChange={event=>{location.hash=sections.find(item=>item[0]===event.target.value)?.[2]||'#setup';}}>{sections.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><nav className="setup-center-nav" aria-label="Setup">{sections.map(([value,label,href])=><a className={active===value?'active':undefined} href={href} key={value}>{label}</a>)}</nav></>;
}
