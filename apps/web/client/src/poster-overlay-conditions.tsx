import "./poster-overlay-conditions.css";
import { overlayClientId } from "./poster-overlay-layer";
import type { OverlayLayer } from "./poster-overlays-types";

type Group = OverlayLayer["conditions"];
type Rule = Group["rules"][number];
type StyleRule = OverlayLayer["styleRules"][number];
type Overrides = StyleRule["overrides"];
type LayerChange = Partial<OverlayLayer> | ((layer:OverlayLayer)=>Partial<OverlayLayer>);
const operators: Array<[Rule["operator"], string]> = [["truthy","has a value"],["falsy","has no value"],["equals","equals"],["not_equals","does not equal"],["contains","contains"],["not_contains","does not contain"],["greater_than","is greater than"],["less_than","is less than"],["greater_than_or_equal","is at least (inclusive)"],["less_than_or_equal","is at most (inclusive)"]];
const shapes: OverlayLayer["shape"][] = ["rounded","square","pill","circle","ticket","ribbon","tag","hexagon","chevron"];

function Rules({value,variables,onChange}:{value:Group;variables:string[];onChange:(value:Group)=>void}) {
  const update=(index:number,changes:Partial<Rule>)=>onChange({...value,rules:value.rules.map((rule,i)=>i===index?{...rule,...changes}:rule)});
  return <>
    <label>Match<select value={value.join} onChange={event=>onChange({...value,join:event.target.value as Group["join"]})}><option value="and">All rules match (AND)</option><option value="or">Any rule matches (OR)</option></select></label>
    {value.rules.map((rule,index)=><div className="overlay-condition-rule" key={index}>
      <select aria-label={`Condition ${index+1} variable`} value={rule.variable} onChange={event=>update(index,{variable:event.target.value})}>{variables.filter(item=>item!=="icon"&&item!=="custom_text").map(item=><option value={item} key={item}>{item.replaceAll("_"," ")}</option>)}</select>
      <select aria-label={`Condition ${index+1} operator`} value={rule.operator} onChange={event=>update(index,{operator:event.target.value as Rule["operator"]})}>{operators.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select>
      {!['truthy','falsy'].includes(rule.operator)?<input aria-label={`Condition ${index+1} value`} type={['greater_than','less_than','greater_than_or_equal','less_than_or_equal'].includes(rule.operator)?'number':'text'} value={rule.value} placeholder={rule.variable==='plex_days_since_added'?'Whole days':'Value'} onChange={event=>update(index,{value:event.target.value})}/>:null}
      {value.rules.length>1?<button type="button" className="icon-button" aria-label={`Remove condition ${index+1}`} onClick={()=>onChange({...value,rules:value.rules.filter((_,i)=>i!==index)})}>×</button>:null}
    </div>)}
    <button type="button" className="secondary" disabled={value.rules.length>=8} onClick={()=>onChange({...value,rules:[...value.rules,{variable:value.rules[0]?.variable||"title",operator:"truthy",value:""}]})}>Add condition</button>
  </>;
}

function Override<K extends keyof Overrides>({label,name,value,fallback,onSet,onRemove,children}:{label:string;name:K;value:Overrides[K]|undefined;fallback:Overrides[K];onSet:(key:K,value:Overrides[K])=>void;onRemove:(key:K)=>void;children:(value:NonNullable<Overrides[K]>,set:(value:Overrides[K])=>void)=>React.ReactNode}) {
  const enabled=value!==undefined;
  return <label className="check"><input type="checkbox" checked={enabled} onChange={event=>event.target.checked?onSet(name,fallback):onRemove(name)}/><span>{label}</span>{enabled?children(value as NonNullable<Overrides[K]>,next=>onSet(name,next)):null}</label>;
}

function ColorControl({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}) {
  const valid=/^#[0-9a-f]{6}$/i.test(value);
  return <span className="overlay-color-control"><input aria-label={`${label} picker`} type="color" value={valid?value:"#000000"} onChange={event=>onChange(event.target.value)}/><input aria-label={`${label} hex value`} type="text" value={value} maxLength={7} spellCheck={false} onChange={event=>{const next=event.target.value.trim();if(/^#[0-9a-f]{0,6}$/i.test(next))onChange(next)}} onBlur={()=>{if(!valid)onChange("#000000")}}/></span>;
}

export default function OverlayConditions({layer,variables,onChange}:{layer:OverlayLayer;variables:string[];onChange:(changes:LayerChange)=>void}) {
  const fallback:Rule={variable:layer.variable,operator:layer.condition.operator,value:layer.condition.value};
  const visibility=layer.conditions||{join:"and",rules:[fallback]},styleRules=[...(layer.styleRules||[])].sort((a,b)=>(a.rank||999)-(b.rank||999));
  const commit=(rules:StyleRule[])=>onChange({styleRules:rules.map((rule,index)=>({...rule,overrides:{...rule.overrides},rank:index+1}))});
  const updateStyle=(id:string,changes:Partial<StyleRule>)=>onChange(current=>({styleRules:[...(current.styleRules||[])].sort((a,b)=>(a.rank||999)-(b.rank||999)).map((rule,index)=>rule.id===id?{...rule,...changes,overrides:{...rule.overrides,...changes.overrides},rank:index+1}:{...rule,overrides:{...rule.overrides},rank:index+1})}));
  const setOverride=<K extends keyof Overrides>(id:string,key:K,value:Overrides[K])=>onChange(current=>({styleRules:[...(current.styleRules||[])].sort((a,b)=>(a.rank||999)-(b.rank||999)).map((rule,index)=>rule.id===id?{...rule,overrides:{...rule.overrides,[key]:value},rank:index+1}:{...rule,overrides:{...rule.overrides},rank:index+1})}));
  const removeOverride=(id:string,key:keyof Overrides)=>onChange(current=>({styleRules:[...(current.styleRules||[])].sort((a,b)=>(a.rank||999)-(b.rank||999)).map((rule,index)=>{const overrides={...rule.overrides};if(rule.id===id)delete overrides[key];return{...rule,overrides,rank:index+1}})}));
  const defaultFormatting=():Overrides=>({background:layer.background,foreground:layer.foreground,iconColor:layer.iconColor||layer.foreground,iconSize:layer.iconSize,fontSize:layer.fontSize,fontFamily:layer.fontFamily,fontWeight:layer.fontWeight,textAlign:layer.textAlign,textTransform:layer.textTransform,textOpacity:layer.textOpacity,backgroundOpacity:layer.backgroundOpacity,shape:layer.shape,padding:layer.padding,borderRadius:layer.borderRadius,prefix:layer.prefix,suffix:layer.suffix,posterAware:layer.posterAware});
  const move=(index:number,direction:-1|1)=>{const target=index+direction;if(target<0||target>=styleRules.length)return;const next=[...styleRules];[next[index],next[target]]=[next[target],next[index]];commit(next);};
  const add=()=>commit([...styleRules,{id:`style_${overlayClientId()}`,name:`Sub-condition ${styleRules.length+1}`,rank:styleRules.length+1,conditions:{join:"and",rules:[{variable:layer.variable,operator:"contains",value:""}]},overrides:defaultFormatting()}]);
  return <div className="overlay-condition-workspace">
    <fieldset className="overlay-condition-builder"><legend>Main condition — show this layer</legend><p className="muted overlay-condition-help">The layer and its default settings appear only when this condition matches.</p><Rules value={visibility} variables={variables} onChange={conditions=>onChange({conditions})}/></fieldset>
    <section className="overlay-style-variants">
      <header><div><h3>Ranked sub-conditions</h3><small className="muted">Rank 1 has highest priority. A matching sub-condition changes only the checked appearance settings.</small></div><button type="button" className="secondary" disabled={styleRules.length>=8} onClick={add}>Add sub-condition</button></header>
      {styleRules.length?<label>When several sub-conditions match<select value={layer.styleMode||"first"} onChange={event=>onChange({styleMode:event.target.value as OverlayLayer["styleMode"]})}><option value="first">Use highest-ranked match</option><option value="merge">Merge matches by rank</option></select></label>:null}
      {styleRules.map((style,index)=><details className="overlay-style-rule" open key={style.id}>
        <summary><strong>Rank {index+1}: {style.name}</strong><button type="button" className="text-button" onClick={event=>{event.preventDefault();commit(styleRules.filter((_,i)=>i!==index))}}>Remove</button></summary>
        <div className="overlay-style-rank-actions"><button type="button" className="secondary" disabled={index===0} onClick={()=>move(index,-1)}>Move up</button><button type="button" className="secondary" disabled={index===styleRules.length-1} onClick={()=>move(index,1)}>Move down</button></div>
        <label>Sub-condition name<input value={style.name} maxLength={50} onChange={event=>updateStyle(style.id,{name:event.target.value})}/></label>
        <Rules value={style.conditions} variables={variables} onChange={conditions=>updateStyle(style.id,{conditions})}/>
        <section className="overlay-style-format"><div className="overlay-style-format-header"><div><h4>Formatting for this sub-condition</h4><p className="muted">These settings belong only to Rank {index+1}. Unchecked settings inherit the layer default.</p></div><button type="button" className="secondary" onClick={()=>updateStyle(style.id,{overrides:defaultFormatting()})}>Copy all default formatting</button></div><div className="overlay-style-overrides">
          <Override label="Shape / background color" name="background" value={style.overrides.background} fallback={layer.background} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><ColorControl label="Shape background color" value={value} onChange={set}/>}</Override>
          <Override label="Text color" name="foreground" value={style.overrides.foreground} fallback={layer.foreground} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><ColorControl label="Text color" value={value} onChange={set}/>}</Override>
          {layer.kind==="icon"?<><Override label="Icon color" name="iconColor" value={style.overrides.iconColor} fallback={layer.iconColor||layer.foreground} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><ColorControl label="Icon color" value={value} onChange={set}/>}</Override><Override label="Icon size" name="iconSize" value={style.overrides.iconSize} fallback={layer.iconSize} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="range" min="10" max="100" value={value} onChange={event=>set(Number(event.target.value))}/>}</Override></>:null}
          <Override label="Font size" name="fontSize" value={style.overrides.fontSize} fallback={layer.fontSize} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="range" min="12" max="96" value={value} onChange={event=>set(Number(event.target.value))}/>}</Override>
          <Override label="Font" name="fontFamily" value={style.overrides.fontFamily} fallback={layer.fontFamily} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><select value={value} onChange={event=>set(event.target.value as OverlayLayer["fontFamily"])}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="condensed">Condensed</option><option value="monospace">Monospace</option></select>}</Override>
          <Override label="Font weight" name="fontWeight" value={style.overrides.fontWeight} fallback={layer.fontWeight} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><select value={value} onChange={event=>set(Number(event.target.value) as OverlayLayer["fontWeight"])}>{[400,500,600,700,800,900].map(weight=><option value={weight} key={weight}>{weight}</option>)}</select>}</Override>
          <Override label="Text alignment" name="textAlign" value={style.overrides.textAlign} fallback={layer.textAlign} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><select value={value} onChange={event=>set(event.target.value as OverlayLayer["textAlign"])}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>}</Override>
          <Override label="Capitalization" name="textTransform" value={style.overrides.textTransform} fallback={layer.textTransform} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><select value={value} onChange={event=>set(event.target.value as OverlayLayer["textTransform"])}><option value="none">As entered</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option></select>}</Override>
          <Override label="Shape" name="shape" value={style.overrides.shape} fallback={layer.shape} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><select value={value} onChange={event=>set(event.target.value as OverlayLayer["shape"])}>{shapes.map(shape=><option value={shape} key={shape}>{shape}</option>)}</select>}</Override>
          <Override label="Text opacity" name="textOpacity" value={style.overrides.textOpacity} fallback={layer.textOpacity} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="range" min="0" max="1" step="0.05" value={value} onChange={event=>set(Number(event.target.value))}/>}</Override>
          <Override label="Shape opacity" name="backgroundOpacity" value={style.overrides.backgroundOpacity} fallback={layer.backgroundOpacity} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="range" min="0" max="1" step="0.05" value={value} onChange={event=>set(Number(event.target.value))}/>}</Override>
          <Override label="Inner spacing" name="padding" value={style.overrides.padding} fallback={layer.padding} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="range" min="2" max="30" value={value} onChange={event=>set(Number(event.target.value))}/>}</Override>
          <Override label="Corner radius" name="borderRadius" value={style.overrides.borderRadius} fallback={layer.borderRadius} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="range" min="0" max="50" value={value} onChange={event=>set(Number(event.target.value))}/>}</Override>
          <Override label="Adaptive contrast" name="posterAware" value={style.overrides.posterAware} fallback={layer.posterAware} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input type="checkbox" checked={value} onChange={event=>set(event.target.checked)}/>}</Override>
          <Override label="Prefix" name="prefix" value={style.overrides.prefix} fallback={layer.prefix} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input value={value} maxLength={30} onChange={event=>set(event.target.value)}/>}</Override>
          <Override label="Suffix" name="suffix" value={style.overrides.suffix} fallback={layer.suffix} onSet={(key,value)=>setOverride(style.id,key,value)} onRemove={key=>removeOverride(style.id,key)}>{(value,set)=><input value={value} maxLength={30} onChange={event=>set(event.target.value)}/>}</Override>
        </div></section>
      </details>)}
      {!styleRules.length?<p className="muted">No sub-conditions. When the main condition matches, the layer uses its default appearance.</p>:null}
    </section>
  </div>;
}
