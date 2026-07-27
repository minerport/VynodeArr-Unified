import type {LibraryItem,LibraryKind} from './library-types';

export type LibraryFilterMode='all'|'monitored'|'missing';
export type LibrarySort='title'|'year'|'attention';

export interface MovieLibraryFilters{
  name:string;
  year:string;
  genre:string;
  collection:string;
}

export interface TvLibraryFilters{
  name:string;
  year:string;
  network:string;
  status:string;
}

export interface LibraryFilterOptions{
  kind:LibraryKind;
  items:LibraryItem[];
  query:string;
  mode:LibraryFilterMode;
  sort:LibrarySort;
  initial:string;
  filters:MovieLibraryFilters|TvLibraryFilters;
}

export function titleInitial(item:Pick<LibraryItem,'title'>):string{
  const first=String(item.title||'').trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first)?first:'#';
}

export function filterLibraryItems(options:LibraryFilterOptions):LibraryItem[]{
  const movie=options.kind==='movies';
  const name=options.filters.name.toLowerCase();
  let items=[...options.items];
  items=items.filter(item=>
    item.title.toLowerCase().includes(options.query)
    &&(
      options.mode==='all'
      ||options.mode==='monitored'&&item.monitoring!=='none'
      ||options.mode==='missing'&&item.monitoring!=='none'
        &&(movie?item.state==='missing':Number(item.missingEpisodes)>0)
    )
  );
  items=items.filter(item=>
    (!options.initial||titleInitial(item)===options.initial)
    &&item.title.toLowerCase().includes(name)
    &&(!options.filters.year||String(item.year)===options.filters.year)
  );
  if(movie){
    const filters=options.filters as MovieLibraryFilters;
    items=items.filter(item=>
      (!filters.genre||(item.genres||[]).some(genre=>genre.toLowerCase()===filters.genre.toLowerCase()))
      &&(!filters.collection||item.collection===filters.collection)
    );
  }else{
    const filters=options.filters as TvLibraryFilters;
    items=items.filter(item=>
      (!filters.network||item.network===filters.network)
      &&(!filters.status||item.status===filters.status)
    );
  }
  items.sort((a,b)=>
    options.sort==='year'
      ?(b.year as number)-(a.year as number)
      :options.sort==='attention'
        ?movie
          ?Number(a.state==='available')-Number(b.state==='available')
          :Number(b.missingEpisodes)-Number(a.missingEpisodes)
        :a.title.localeCompare(b.title)
  );
  return items;
}
