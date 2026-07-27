import type {ResourceType,TemplateDomain} from './guide-templates-types';

const resourceTypes:readonly ResourceType[]=[
  'customFormat',
  'customFormatGroup',
  'qualityProfile',
  'qualitySize',
  'naming'
];
const resourceTypeSet=new Set<string>(resourceTypes);

export interface GuideTemplateRouteFilter{
  initialDomain:TemplateDomain;
  initialTypes:ResourceType[];
}

export function parseGuideTemplateRouteFilter(value=''):GuideTemplateRouteFilter{
  const separator=value.indexOf(':');
  const requestedDomain=separator>=0?value.slice(0,separator):'movie';
  const rawTypes=separator>=0?value.slice(separator+1):value;
  const initialDomain:TemplateDomain=requestedDomain==='tv'?'tv':'movie';
  const initialTypes=rawTypes
    .split(',')
    .filter((item):item is ResourceType=>resourceTypeSet.has(item));
  return {initialDomain,initialTypes};
}
