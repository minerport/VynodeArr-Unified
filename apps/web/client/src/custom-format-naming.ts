export type NamingDomain='movie'|'tv';
export type NamingSettings=Record<string,unknown>;

const tokenPattern=/\{Custom Formats(?::[^}]*)?\}/i;
const fields:Record<NamingDomain,string[]>={
  movie:['standardMovieFormat'],
  tv:['standardEpisodeFormat','dailyEpisodeFormat','animeEpisodeFormat']
};

export const customFormatsToken='{Custom Formats}';

export function namingHasCustomFormatsToken(domain:NamingDomain,naming:NamingSettings){
  return fields[domain].every(field=>!String(naming[field]||'').trim()||tokenPattern.test(String(naming[field])));
}

export function addCustomFormatsToken(domain:NamingDomain,naming:NamingSettings){
  const next=structuredClone(naming);
  for(const field of fields[domain]){
    const value=String(next[field]||'').trim();
    if(value&&!tokenPattern.test(value))next[field]=`${value} ${customFormatsToken}`;
  }
  return next;
}
