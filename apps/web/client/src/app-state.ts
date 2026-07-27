export type LibraryKind='movies'|'tv';
export type LibraryView='poster'|'cards'|'compact'|'list';

export function savedLibraryView(kind:LibraryKind):LibraryView{
  const value=localStorage.getItem(`vynodearr.libraryView.${kind}`);
  return value==='poster'||value==='cards'||value==='compact'||value==='list'?value:'poster';
}

export function createAppState(){
  return {
    csrf:null as string|null,
    user:null as Record<string,unknown>|null,
    mode:null as string|null,
    movies:[] as Record<string,unknown>[],
    tv:[] as Record<string,unknown>[],
    query:'',
    filter:'all',
    movieFilters:{name:'',year:'',genre:'',collection:''},
    tvFilters:{name:'',year:'',network:'',status:''},
    libraryInitial:{movies:'',tv:''},
    libraryRenderLimit:{movies:240,tv:240},
    libraryStale:{movies:false,tv:false},
    views:{movies:savedLibraryView('movies'),tv:savedLibraryView('tv')},
    sort:'title',
    enginesConfigured:false,
    dirty:false,
    sessionMessage:''
  };
}

export type AppState=ReturnType<typeof createAppState>;
