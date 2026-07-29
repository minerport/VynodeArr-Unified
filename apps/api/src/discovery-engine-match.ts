export type DiscoveryDomain='movie'|'tv';

export interface DiscoveryIdentity{
  tmdbId:number;
  tvdbId?:number|null;
}

export interface EngineIdentity{
  tmdbId?:number|string|null;
  tvdbId?:number|string|null;
}

const validId=(value:unknown)=>{
  const id=Number(value);
  return Number.isInteger(id)&&id>0?id:null;
};

export function lookupTermsForIdentity(domain:DiscoveryDomain,identity:DiscoveryIdentity){
  const tmdbId=validId(identity.tmdbId);
  const tvdbId=validId(identity.tvdbId);
  if(!tmdbId)throw new Error('Choose a valid TMDB title');
  return domain==='tv'&&tvdbId?[`tvdb:${tvdbId}`,`tmdb:${tmdbId}`]:[`tmdb:${tmdbId}`];
}

export function exactEngineMatch<T extends EngineIdentity>(domain:DiscoveryDomain,identity:DiscoveryIdentity,matches:T[]){
  const tmdbId=validId(identity.tmdbId);
  const tvdbId=validId(identity.tvdbId);
  return matches.find(value=>domain==='tv'&&tvdbId
    ?validId(value.tvdbId)===tvdbId
    :validId(value.tmdbId)===tmdbId
  );
}

export function payloadMatchesIdentity(domain:DiscoveryDomain,identity:DiscoveryIdentity,payload:EngineIdentity){
  const tmdbId=validId(identity.tmdbId);
  const tvdbId=validId(identity.tvdbId);
  const payloadTmdbId=validId(payload.tmdbId);
  const payloadTvdbId=validId(payload.tvdbId);
  if(!tmdbId)return false;
  if(domain==='movie')return payloadTmdbId===tmdbId;
  if(tvdbId&&payloadTvdbId)return payloadTvdbId===tvdbId;
  return payloadTmdbId===tmdbId;
}
