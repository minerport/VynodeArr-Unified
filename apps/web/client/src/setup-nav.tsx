import type {SetupCenterSection} from './setup-center-types';

export function SetupNav({active}:{active:SetupCenterSection|'engines'|'storage'|'health'}){
 return <nav className="setup-center-nav" aria-label="Setup"><a className={active==='overview'?'active':undefined} href="#setup">Overview</a><a className={active==='engines'?'active':undefined} href="#setup/engines">Media engines</a><a className={active==='storage'?'active':undefined} href="#setup/storage">Storage &amp; destinations</a><a className={active==='search'?'active':undefined} href="#setup/search">Search &amp; downloads</a><a className={active==='integrations'?'active':undefined} href="#setup/integrations">Integrations</a><a className={active==='health'?'active':undefined} href="#setup/health">Health check</a></nav>;
}
