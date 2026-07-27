import type {LibraryItem,LibraryKind} from './library-types';

export type LibrarySort='title'|'year'|'releaseDate'|'rating'|'certification'|'duration'|'added'|'size'|'completion'|'attention'|'random';
export type SortDirection='ascending'|'descending';

export interface LibrarySortOption{
  value:LibrarySort;
  label:string;
  defaultDirection:SortDirection;
}

const commonOptions:LibrarySortOption[]=[
  {value:'title',label:'Title',defaultDirection:'ascending'},
  {value:'year',label:'Year',defaultDirection:'descending'},
  {value:'rating',label:'Rating',defaultDirection:'descending'},
  {value:'certification',label:'Content rating',defaultDirection:'ascending'},
  {value:'duration',label:'Duration',defaultDirection:'descending'},
  {value:'added',label:'Date added',defaultDirection:'descending'},
  {value:'size',label:'Library size',defaultDirection:'descending'},
  {value:'completion',label:'Completion',defaultDirection:'descending'},
  {value:'attention',label:'Attention needed',defaultDirection:'descending'},
  {value:'random',label:'Random',defaultDirection:'ascending'}
];

export function librarySortOptions(kind:LibraryKind):LibrarySortOption[]{
  const date:LibrarySortOption={value:'releaseDate',label:kind==='movies'?'Release date':'First aired',defaultDirection:'descending'};
  return [...commonOptions.slice(0,2),date,...commonOptions.slice(2)].map(option=>option.value==='completion'
    ?{...option,label:kind==='movies'?'Availability':'Episode completion'}
    :option);
}

export function isLibrarySort(value:string):value is LibrarySort{
  return commonOptions.some(option=>option.value===value)||value==='releaseDate';
}

export function defaultSortDirection(kind:LibraryKind,sort:LibrarySort):SortDirection{
  return librarySortOptions(kind).find(option=>option.value===sort)?.defaultDirection||'ascending';
}

const text=(value:unknown)=>String(value||'').trim();
const number=(value:unknown)=>{
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>0?parsed:null;
};
const date=(value:unknown)=>{
  const parsed=Date.parse(text(value));
  return Number.isFinite(parsed)?parsed:null;
};
const completion=(item:LibraryItem,movie:boolean)=>{
  if(number(item.completionPercent)!==null)return Number(item.completionPercent);
  if(movie)return item.hasFile?100:0;
  const counts=text(item.episodeProgress).match(/(\d+)\s*\/\s*(\d+)/);
  return counts&&Number(counts[2])?Number(counts[1])/Number(counts[2])*100:0;
};
const attention=(item:LibraryItem,movie:boolean)=>movie
  ?item.state==='missing'?2:item.state==='cutoff'?1:0
  :Number(item.missingEpisodes||0)+Number(item.cutoffUnmetEpisodes||0);
const randomRank=(id:string,seed:number)=>{
  let hash=(seed|0)^0x9e3779b9;
  for(let index=0;index<id.length;index++)hash=Math.imul(hash^id.charCodeAt(index),0x85ebca6b);
  return (hash^(hash>>>16))>>>0;
};

function value(item:LibraryItem,sort:LibrarySort,movie:boolean,seed:number):string|number|null{
  switch(sort){
    case'title':return text(item.sortTitle||item.title);
    case'year':return number(item.year);
    case'releaseDate':return date(movie?item.releaseDate:item.firstAired);
    case'rating':return number(item.rating);
    case'certification':return text(item.certification)||null;
    case'duration':return number(item.runtimeMinutes);
    case'added':return date(item.addedAt);
    case'size':return number(item.sizeOnDisk);
    case'completion':return completion(item,movie);
    case'attention':return attention(item,movie);
    case'random':return randomRank(item.id,seed);
  }
}

export function sortLibraryItems(items:LibraryItem[],kind:LibraryKind,sort:LibrarySort,direction:SortDirection,seed=0):LibraryItem[]{
  const movie=kind==='movies',factor=direction==='ascending'?1:-1;
  return [...items].sort((left,right)=>{
    const a=value(left,sort,movie,seed),b=value(right,sort,movie,seed);
    if(a===null&&b===null)return left.title.localeCompare(right.title);
    if(a===null)return 1;
    if(b===null)return-1;
    const compared=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
    if(compared)return compared*factor;
    if(sort==='year'){
      const leftDate=date(movie?left.releaseDate:left.firstAired),rightDate=date(movie?right.releaseDate:right.firstAired);
      if(leftDate!==null&&rightDate!==null&&leftDate!==rightDate)return(leftDate-rightDate)*factor;
      if(leftDate===null&&rightDate!==null)return 1;
      if(leftDate!==null&&rightDate===null)return-1;
    }
    return left.title.localeCompare(right.title);
  });
}
