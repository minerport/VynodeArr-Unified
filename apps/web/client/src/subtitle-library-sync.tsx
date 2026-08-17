import { useState } from "react";
import type { MediaExpansionOptions } from "./media-expansion-types";
export default function SubtitleLibrarySync({options,onSync,last}:{options:MediaExpansionOptions;onSync:()=>Promise<unknown>;last:string|null}){
 const[busy,setBusy]=useState(false);
 async function sync(){setBusy(true);try{const value=await options.request<{movies:number;episodes:number;removed:number;failures:string[]}>("/api/subtitles/libraries/sync",{method:"POST"});options.notify(`Reviewed ${value.movies} movies and ${value.episodes} television episodes.${value.removed?` Removed ${value.removed} stale records.`:""}${value.failures.length?` ${value.failures.length} source(s) need attention.`:""}`);await onSync();}catch(error){options.notify(error instanceof Error?error.message:"Library review failed.","error");}finally{setBusy(false);}}
 return <><button className="secondary" type="button" disabled={busy} onClick={()=>void sync()}>{busy?"Reviewing…":"Review VynodeArr libraries"}</button><p className="muted subtitle-library-source">Movies and television episodes synchronize directly from VynodeArr; no separate library-manager connection is required. Policies inherit from series to season to episode, with episode overrides taking priority.{last?` Last reviewed ${new Date(last).toLocaleString()}.`:""}</p></>;
}
