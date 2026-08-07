import type {OverlayMedia,PlexMatchReview,PlexOverlayConnection,PosterOverlayMountOptions} from "./poster-overlays-types";

export async function loadPlexPreviewMedia(options:PosterOverlayMountOptions,media:Array<OverlayMedia&{domain:"movie"|"tv"}>,domain:"movie"|"tv"){
  const connection=await options.request<PlexOverlayConnection>("/api/poster-overlays/plex"),libraryKeys=connection.libraries.filter(item=>(item.type==="movie"?"movie":"tv")===domain).map(item=>item.key);
  if(!connection.configured||!libraryKeys.length)return[];
  const review=await options.request<PlexMatchReview>("/api/poster-overlays/plex/matches",{method:"POST",body:JSON.stringify({libraryKeys})});
  return review.entries.flatMap(entry=>{
    const plex=entry.plex[0],base=media.find(item=>item.domain===entry.domain&&item.id===entry.id);
    if(entry.status!=="matched"||!plex||plex.addedAt==null||!base)return[];
    return[{...base,plexAddedAt:plex.addedAt,previewKey:`plex:${entry.plexLibrary.key}:${plex.ratingKey}`,previewLabel:`${entry.title}${entry.year?` (${entry.year})`:""} — ${entry.plexLibrary.title}`}];
  });
}
