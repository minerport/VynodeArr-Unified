export type ServiceSettingsAction=
  |{name:'discover'}
  |{name:'mediaManagement'}
  |{name:'libraryHealth'}
  |{name:'libraryReview'}
  |{name:'qualityProfiles'}
  |{name:'guideTemplates';templateFilter:string}
  |{name:'selectionRules';section:'custom-formats'|'release-profiles'}
  |{name:'providerSettings';kind:'indexers'|'downloadClients'|'importLists'}
  |{name:'mediaExpansionSettings';section:'music'|'subtitles';view:string;serviceSection:string}
  |{name:'rootFolders'};

export function resolveServiceSettingsAction(
  section:string,
  templateFilter:string
):ServiceSettingsAction{
  if(section==='music')return{name:'mediaExpansionSettings',section:'music',view:'settings/specific',serviceSection:'music'};
  if(section==='subtitles')return{name:'mediaExpansionSettings',section:'subtitles',view:'settings',serviceSection:'subtitles'};
  if(templateFilter==='music'){
    if(section==='root-folders')return{name:'mediaExpansionSettings',section:'music',view:'settings/folders',serviceSection:section};
    if(section==='profiles')return{name:'mediaExpansionSettings',section:'music',view:'settings/profiles',serviceSection:section};
    if(section==='indexers')return{name:'mediaExpansionSettings',section:'music',view:'settings/indexers',serviceSection:section};
    if(section==='download-clients')return{name:'mediaExpansionSettings',section:'music',view:'settings/download-clients',serviceSection:section};
  }
  if(section==='discover')return{name:'discover'};
  if(section==='media-management')return{name:'mediaManagement'};
  if(section==='library-health')return{name:'libraryHealth'};
  if(section==='library-review')return{name:'libraryReview'};
  if(section==='profiles')return{name:'qualityProfiles'};
  if(section==='guide-templates')return{name:'guideTemplates',templateFilter};
  if(section==='custom-formats'||section==='release-profiles'){
    return{name:'selectionRules',section};
  }
  if(section==='indexers')return{name:'providerSettings',kind:'indexers'};
  if(section==='download-clients')return{name:'providerSettings',kind:'downloadClients'};
  if(section==='import-lists')return{name:'providerSettings',kind:'importLists'};
  return{name:'rootFolders'};
}
