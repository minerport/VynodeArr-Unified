export type ServiceSettingsAction=
  |{name:'discover'}
  |{name:'mediaManagement'}
  |{name:'qualityProfiles'}
  |{name:'guideTemplates';templateFilter:string}
  |{name:'selectionRules';section:'custom-formats'|'release-profiles'}
  |{name:'providerSettings';kind:'indexers'|'downloadClients'}
  |{name:'rootFolders'};

export function resolveServiceSettingsAction(
  section:string,
  templateFilter:string
):ServiceSettingsAction{
  if(section==='discover')return{name:'discover'};
  if(section==='media-management')return{name:'mediaManagement'};
  if(section==='profiles')return{name:'qualityProfiles'};
  if(section==='guide-templates')return{name:'guideTemplates',templateFilter};
  if(section==='custom-formats'||section==='release-profiles'){
    return{name:'selectionRules',section};
  }
  if(section==='indexers')return{name:'providerSettings',kind:'indexers'};
  if(section==='download-clients')return{name:'providerSettings',kind:'downloadClients'};
  return{name:'rootFolders'};
}
