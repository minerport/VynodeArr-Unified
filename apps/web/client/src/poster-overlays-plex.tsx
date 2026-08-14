import { useCallback, useEffect, useState } from "react";
import type {
  OverlayTemplate,
  PlexMatchReview,
  PlexOverlayConnection,
  PlexPosterApplication,
  PosterOverlayMountOptions,
} from "./poster-overlays-types";

const errorText = (reason: unknown) =>
  reason instanceof Error ? reason.message : "Plex operation failed.";
type VariableFilter={variable:string;operator:string;value:string};
const filterMatches=(values:Record<string,unknown>|undefined,filter:VariableFilter)=>{
  if(!filter.variable)return true;
  const actual=values?.[filter.variable],text=String(actual??"").toLowerCase(),expected=filter.value.toLowerCase(),left=Number(actual),right=Number(filter.value);
  if(filter.operator==="truthy")return Boolean(text);
  if(filter.operator==="falsy")return !text;
  if(filter.operator==="equals")return text===expected;
  if(filter.operator==="not_equals")return text!==expected;
  if(filter.operator==="contains")return text.includes(expected);
  if(filter.operator==="not_contains")return !text.includes(expected);
  if(!Number.isFinite(left)||!Number.isFinite(right))return false;
  return filter.operator==="greater_than"?left>right:filter.operator==="less_than"?left<right:filter.operator==="greater_than_or_equal"?left>=right:left<=right;
};
const matchesFilters=(values:Record<string,unknown>|undefined,filters:VariableFilter[])=>filters.every(filter=>filterMatches(values,filter));

export function PlexConnectionPanel({
  options,
  templates,
  variables,
}: {
  options: PosterOverlayMountOptions;
  templates: OverlayTemplate[];
  variables: string[];
}) {
  const [plex, setPlex] = useState<PlexOverlayConnection | null>(null),
    [endpoint, setEndpoint] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedLibraries, setSelectedLibraries] = useState<string[]>([]),
    [review, setReview] = useState<PlexMatchReview | null>(null),
    [reviewFilter, setReviewFilter] = useState<
      "all" | "matched" | "unmatched" | "ambiguous"
    >("all"),
    [reviewQuery, setReviewQuery] = useState(""),
    [visibleLimit, setVisibleLimit] = useState(100),
    [variableFilters, setVariableFilters] = useState<Array<{variable:string;operator:string;value:string}>>([]),
    [templateId, setTemplateId] = useState(""),
    [selectedTargets, setSelectedTargets] = useState<string[]>([]),
    [applications, setApplications] = useState<PlexPosterApplication[]>([]),
    [historyExpanded, setHistoryExpanded] = useState(false);
  const load = useCallback(async () => {
    try {
      const [connection, history] = await Promise.all([
        options.request<PlexOverlayConnection>("/api/poster-overlays/plex"),
        options.request<{ applications: PlexPosterApplication[] }>(
          "/api/poster-overlays/plex/applications",
        ),
      ]);
      setPlex(connection);
      setEndpoint(connection.endpoint || "");
      setApplications(history.applications);
      setSelectedLibraries((current) =>
        current.length ? current : connection.libraries.map((item) => item.key),
      );
    } catch (reason) {
      options.notify(errorText(reason), "error");
    }
  }, [options]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(()=>setVisibleLimit(100),[review,reviewFilter,reviewQuery]);
  const save = async () => {
    setBusy(true);
    try {
      const value = await options.request<PlexOverlayConnection>(
        "/api/poster-overlays/plex",
        { method: "POST", body: JSON.stringify({ endpoint, token }) },
      );
      setPlex(value);
      setToken("");
      options.notify(`Connected to ${value.server?.name || "Plex"}.`);
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !confirm(
        "Remove the saved Plex connection? Existing rollback records remain available.",
      )
    )
      return;
    setBusy(true);
    try {
      await options.request("/api/poster-overlays/plex", { method: "DELETE" });
      await load();
      setReview(null);
      options.notify("Plex connection removed.");
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setBusy(false);
    }
  };
  const reviewMatches = async () => {
    setBusy(true);
    try {
      const value = await options.request<PlexMatchReview>(
        "/api/poster-overlays/plex/matches",
        {
          method: "POST",
          body: JSON.stringify({ libraryKeys: selectedLibraries }),
        },
      );
      setReview(value);
      setSelectedTargets([]);
      options.notify(
        `Plex match review completed: ${value.summary.matched} matched.`,
      );
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setBusy(false);
    }
  };
  const selectedTemplate = templates.find((item) => item.id === templateId),
    targetKey = (item: PlexMatchReview["entries"][number]) =>
      `${item.plexLibrary.key}:${item.domain}:${item.id}:${item.plex[0]?.ratingKey || ""}`,
    compatible = (item: PlexMatchReview["entries"][number]) =>
      item.status === "matched" &&
      Boolean(selectedTemplate) &&
      (selectedTemplate?.domain === "all" ||
        selectedTemplate?.domain === item.domain),
    selectedEntries = (review?.entries || []).filter((item) =>
      selectedTargets.includes(targetKey(item)),
    ),
    selectedEntry = selectedEntries[0],
    previewUrl = (
      mode: "original" | "preview",
      item: PlexMatchReview["entries"][number],
    ) => {
      const params = new URLSearchParams({
        libraryKey: item.plexLibrary.key,
        ratingKey: item.plex[0].ratingKey,
      });
      if (mode === "preview") params.set("templateId", templateId);
      return `/api/poster-overlays/plex/${mode}/${item.domain}/${item.id}?${params}`;
    };
  const filteredEntries = (review?.entries || [])
    .filter(
      (item) =>
        (reviewFilter === "all" || item.status === reviewFilter) &&
        (!reviewQuery.trim() ||
          `${item.title} ${item.year || ""} ${item.plexLibrary.title} ${item.externalIds.join(" ")}`
            .toLowerCase()
            .includes(reviewQuery.trim().toLowerCase())) &&
        matchesFilters(item.variableValues,variableFilters),
    ),visibleEntries=filteredEntries.slice(0,visibleLimit);
  const toggleTarget = (key: string, checked: boolean) =>
    setSelectedTargets((current) =>
      checked
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((value) => value !== key),
    );
  const apply = async () => {
    if (!selectedEntries.length) return;
    setBusy(true);
    try {
      const targets = selectedEntries.map((item) => ({
        domain: item.domain,
        mediaId: item.id,
        title: item.title,
        libraryKey: item.plexLibrary.key,
        ratingKey: item.plex[0].ratingKey,
      }));
      if (targets.length === 1) {
        const value = await options.request<{
          application: PlexPosterApplication;
        }>("/api/poster-overlays/plex/apply", {
          method: "POST",
          body: JSON.stringify({ templateId, ...targets[0] }),
        });
        setApplications((current) => [value.application, ...current]);
        options.notify(
          `${targets[0].title} was updated in Plex. Rollback artwork is ready.`,
        );
      } else {
        const applied:PlexPosterApplication[]=[],failures:unknown[]=[];
        for(let index=0;index<targets.length;index+=500){const value=await options.request<{applications:PlexPosterApplication[];failures:unknown[]}>("/api/poster-overlays/plex/apply-batch",{method:"POST",body:JSON.stringify({templateId,targets:targets.slice(index,index+500)})});applied.push(...value.applications);failures.push(...value.failures);}
        setApplications((current) => [...applied, ...current]);
        options.notify(
          `${applied.length} Plex posters updated${failures.length ? `; ${failures.length} failed` : ""}.`,
        );
      }
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (application: PlexPosterApplication) => {
    setBusy(true);
    try {
      const value = await options.request<{
        application: PlexPosterApplication;
      }>(`/api/poster-overlays/plex/applications/${application.id}/restore`, {
        method: "POST",
        body: "{}",
      });
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id ? value.application : item,
        ),
      );
      options.notify(
        `${application.title} was restored to its captured Plex poster.`,
      );
    } catch (reason) {
      options.notify(errorText(reason), "error");
    } finally {
      setBusy(false);
    }
  };
  const restoreMany=async(items:PlexPosterApplication[])=>{
    if(!items.length)return;
    setBusy(true);let restored=0;
    try{
      for(const application of items){
        try{const value=await options.request<{application:PlexPosterApplication}>(`/api/poster-overlays/plex/applications/${application.id}/restore`,{method:"POST",body:"{}"});setApplications(current=>current.map(item=>item.id===application.id?value.application:item));restored++;}catch(reason){options.notify(`${application.title}: ${errorText(reason)}`,"error");}
      }
      options.notify(`${restored} Plex poster${restored===1?"":"s"} restored.`);
    }finally{setBusy(false);}
  };
  const restorableApplications=applications.filter(item=>item.status==="applied"),filteredRestores=restorableApplications.filter(item=>matchesFilters(item.variableValues,variableFilters));
  return (
    <section
      className="panel plex-connection-panel"
      style={{ marginBottom: 16 }}
    >
      <style>{`.plex-match-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:end}.plex-match-list{display:grid;gap:8px;max-height:620px;overflow:auto;padding:2px}.plex-match-row{display:grid;grid-template-columns:44px minmax(220px,1.3fr) minmax(260px,1fr) auto;gap:16px;align-items:center;min-height:76px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--panel,#08111f) 88%,transparent);cursor:pointer}.plex-match-row:hover{border-color:var(--accent,#58a6ff);background:color-mix(in srgb,var(--panel,#08111f) 78%,var(--accent,#58a6ff) 8%)}.plex-match-row.is-selected{border-color:var(--accent,#58a6ff);box-shadow:inset 3px 0 0 var(--accent,#58a6ff)}.plex-match-row.is-disabled{cursor:not-allowed;opacity:.68}.plex-match-check{display:grid;place-items:center;align-self:stretch}.plex-match-check input{width:22px;height:22px;margin:0}.plex-match-title,.plex-match-details{display:grid;gap:4px;min-width:0}.plex-match-title strong{font-size:1rem;line-height:1.25}.plex-match-title small,.plex-match-details small{color:var(--muted);overflow-wrap:anywhere}.plex-match-status{justify-self:end}.plex-match-empty{padding:28px;text-align:center;border:1px dashed var(--border);border-radius:12px;color:var(--muted)}@media(max-width:760px){.plex-match-toolbar,.plex-match-row{grid-template-columns:44px minmax(0,1fr)}.plex-match-details,.plex-match-status{grid-column:2}.plex-match-row{gap:8px 12px;min-height:96px}.plex-match-status{justify-self:start}.plex-match-list{max-height:70dvh}}`}</style>
      <style>{`.plex-connection-panel{min-width:0}.plex-connection-panel .panel-heading{align-items:flex-start}.plex-connection-panel .panel-heading>div{min-width:0}.plex-server-title{overflow-wrap:anywhere}.plex-connection-panel>.overlay-scope-row>label{display:grid;gap:6px;min-width:0}.plex-connection-panel>.overlay-scope-row input{width:100%;min-width:0}.plex-library-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:12px 0}.plex-library-option{display:grid!important;grid-template-columns:auto minmax(0,1fr);gap:10px!important;align-items:center;padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--panel,#08111f) 90%,transparent);cursor:pointer}.plex-library-option:has(input:checked){border-color:var(--accent,#58a6ff);background:color-mix(in srgb,var(--panel,#08111f) 82%,var(--accent,#58a6ff) 10%)}.plex-library-option input{width:20px;height:20px;margin:0}.plex-library-option span{display:grid;min-width:0}.plex-library-option small{color:var(--muted)}.plex-history-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.plex-history-header h3{margin-bottom:2px}.plex-history-list{display:grid;gap:8px;margin-top:12px}.plex-history-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;align-items:center;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--panel,#08111f) 90%,transparent)}.plex-history-content{display:grid;gap:4px;min-width:0}.plex-history-content small{color:var(--muted);overflow-wrap:anywhere}.plex-history-content .badge{justify-self:start}.plex-history-card .form-actions{margin:0}@media(max-width:760px){.plex-connection-panel{padding:14px!important}.plex-connection-panel .panel-heading{display:grid!important;gap:10px}.plex-connection-panel .panel-heading .badge{justify-self:start}.plex-connection-panel .overlay-scope-row{grid-template-columns:1fr}.plex-connection-panel .form-actions{display:grid;grid-template-columns:1fr}.plex-library-picker{grid-template-columns:1fr}.plex-history-header{align-items:flex-start}.plex-history-card{grid-template-columns:1fr}.plex-history-card .form-actions{display:grid}}`}</style>
      <style>{`.plex-match-review{display:grid;gap:10px;padding:14px}.plex-match-review>.form-actions,.plex-match-review .overlay-condition-builder>.form-actions{margin-top:0;flex-wrap:wrap}.plex-match-review>.form-actions{justify-content:flex-start}.plex-match-review>label{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.plex-match-review>label select{width:min(320px,100%)}.plex-match-review>label small{flex:1 1 260px}.plex-match-review>.overlay-condition-builder{gap:8px;padding:10px 12px}.plex-match-review>.overlay-condition-builder>p{margin:0}@media(max-width:760px){.plex-match-review>label{display:grid}.plex-match-review>label select{width:100%}}`}</style>
      <style>{`.plex-library-review{display:grid;gap:10px}.plex-library-review>p{margin:0}.plex-library-review>.plex-library-picker{margin:0}.plex-review-libraries{width:auto;justify-self:start}.plex-match-review .plex-match-toolbar{grid-template-columns:minmax(260px,1fr) auto}.plex-match-review .plex-match-toolbar label{display:grid;grid-template-columns:auto minmax(220px,1fr);align-items:center;gap:8px}.plex-match-review .plex-match-toolbar input{margin:0}.plex-match-review>.form-actions{gap:8px}.plex-match-review>.overlay-condition-builder .overlay-condition-rule{grid-template-columns:minmax(180px,1fr) minmax(150px,.7fr) minmax(120px,1fr) auto}.plex-match-list{display:grid;grid-template-columns:1fr;align-content:start;gap:14px}.plex-match-group{display:grid;gap:7px}.plex-match-group>h3{display:flex;align-items:center;justify-content:space-between;margin:0;padding:0 2px;font-size:.95rem}.plex-match-group-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.plex-match-row{grid-template-columns:28px minmax(0,1fr) auto;gap:8px;min-height:44px;padding:7px 9px}.plex-match-check{grid-row:auto}.plex-match-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.plex-match-title strong{font-size:.88rem}.plex-match-status{grid-column:auto;grid-row:auto}.plex-match-empty{grid-column:1/-1}.plex-history-panel{padding:14px}.plex-history-panel .plex-history-header .form-actions{margin:0;flex-wrap:wrap}.plex-history-list{grid-template-columns:repeat(3,minmax(0,1fr))}.plex-history-card{grid-template-columns:minmax(0,1fr);align-content:start;min-height:112px}.plex-history-card .form-actions{justify-content:flex-start}.plex-history-card .form-actions button{width:100%}@media(max-width:1100px){.plex-match-group-items,.plex-history-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.plex-match-review .plex-match-toolbar,.plex-match-review .plex-match-toolbar label,.plex-match-group-items,.plex-history-list{grid-template-columns:1fr}.plex-match-review .plex-match-toolbar strong{font-size:.85rem}.plex-match-review>.overlay-condition-builder .overlay-condition-rule{grid-template-columns:1fr}.plex-history-panel .plex-history-header{display:grid}.plex-review-libraries{width:100%}}`}</style>
      <style>{`.plex-history-panel{padding:0!important;overflow:hidden}.plex-history-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer;list-style:none}.plex-history-summary::-webkit-details-marker{display:none}.plex-history-summary h3,.plex-history-summary p{margin:0}.plex-history-summary .secondary{padding:.45rem .65rem}.plex-history-panel[open] .plex-history-summary{border-bottom:1px solid var(--border)}.plex-history-body{display:grid;gap:10px;padding:12px 14px}.plex-history-body>p{margin:0}.plex-history-header{justify-content:flex-end}.plex-history-list{display:grid;grid-template-columns:1fr!important;gap:0;margin:0}.plex-history-card{display:grid;grid-template-columns:minmax(0,1fr) auto!important;min-height:0!important;padding:8px 2px;border:0;border-bottom:1px solid var(--border);border-radius:0;background:transparent}.plex-history-content{grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:3px 10px}.plex-history-content small{grid-column:1}.plex-history-content .badge{grid-column:2;grid-row:1/3}.plex-history-card .form-actions button{width:auto!important}@media(max-width:760px){.plex-history-summary{align-items:flex-start}.plex-history-card{grid-template-columns:1fr!important}.plex-history-content{grid-template-columns:minmax(0,1fr) auto}.plex-history-card .form-actions button{width:100%!important}}`}</style>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PLEX ARTWORK</span>
          <h2 className="plex-server-title">
            {plex?.configured
              ? `Connected to ${plex.server?.name || "Plex"}`
              : "Connect Plex Media Server"}
          </h2>
          <p className="muted">
            Match by external ID, preview real Plex artwork, then apply to one,
            selected, or all matched titles with an individual rollback poster
            for every change.
          </p>
        </div>
        <span className={`badge${plex?.configured ? " green" : ""}`}>
          {plex?.configured ? "CONNECTED" : "NOT CONNECTED"}
        </span>
      </div>
      <div className="overlay-scope-row">
        <label>
          Plex server URL
          <input
            type="url"
            value={endpoint}
            placeholder="http://192.168.1.10:32400"
            onChange={(event) => setEndpoint(event.target.value)}
          />
        </label>
        <label>
          Plex access token
          <input
            type="password"
            value={token}
            placeholder={
              plex?.configured
                ? "Saved securely — leave blank to keep"
                : "Enter token"
            }
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || !endpoint || (!plex?.configured && !token)}
          onClick={() => void save()}
        >
          {busy
            ? "Working…"
            : plex?.configured
              ? "Revalidate connection"
              : "Test and save"}
        </button>
        {plex?.configured ? (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remove connection
          </button>
        ) : null}
      </div>
      {plex?.configured ? (
        <div className="notice plex-library-review">
          <strong>Choose libraries and revalidate matches</strong>
          <p className="muted">
            Select only the Plex libraries whose posters you want to review or change. Reviewing matches does not modify artwork.
          </p>
          <div className="plex-library-picker">
            {plex.libraries.map((library) => (
              <label className="plex-library-option" key={library.key}>
                <input
                  type="checkbox"
                  checked={selectedLibraries.includes(library.key)}
                  onChange={(event) =>
                    setSelectedLibraries((current) =>
                      event.target.checked
                        ? [...current, library.key]
                        : current.filter((key) => key !== library.key),
                    )
                  }
                />
                <span>
                  <strong>{library.title}</strong>
                  <small>
                    {library.type === "movie" ? "Movies" : "Television"}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="secondary plex-review-libraries"
            disabled={busy || !selectedLibraries.length}
            onClick={() => void reviewMatches()}
          >
            Review {selectedLibraries.length} selected{" "}
            {selectedLibraries.length === 1 ? "library" : "libraries"}
          </button>
        </div>
      ) : null}
      {review ? (
        <div className="notice plex-match-review">
          <div className="plex-match-toolbar">
            <label>
              Find a Plex library title
              <input
                type="search"
                value={reviewQuery}
                placeholder="Search title, year, library, TMDB, TVDB, or IMDb"
                onChange={(event) => setReviewQuery(event.target.value)}
              />
            </label>
            <strong>
              {review.summary.matched} matched · {review.summary.unmatched}{" "}
              unmatched · {review.summary.ambiguous} ambiguous
            </strong>
          </div>
          <div className="form-actions">
            {(["all", "matched", "unmatched", "ambiguous"] as const).map(
              (value) => (
                <button
                  type="button"
                  className={reviewFilter === value ? "primary" : "secondary"}
                  onClick={() => setReviewFilter(value)}
                  key={value}
                >
                  {value}
                </button>
              ),
            )}
          </div>
          <label>
            Plex poster style
            <select
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setSelectedTargets([]);
              }}
            >
              <option value="">Choose a Plex style</option>
              {templates
                .filter((item) => item.enabled && item.target === "plex")
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <small className="muted">
              Only styles saved with the Plex artwork destination are available
              here.
            </small>
          </label>
          <fieldset className="overlay-condition-builder">
            <legend>Filter titles by variables</legend>
            <p className="muted">All filter rules must match. Filters affect the list, Select filtered, and filtered restore.</p>
            {variableFilters.map((filter,index)=><div className="overlay-condition-rule" key={index}>
              <select aria-label={`Plex filter ${index+1} variable`} value={filter.variable} onChange={event=>setVariableFilters(current=>current.map((item,i)=>i===index?{...item,variable:event.target.value}:item))}><option value="">Choose variable</option>{variables.filter(item=>!['icon','custom_text'].includes(item)).map(item=><option value={item} key={item}>{item.replaceAll('_',' ')}</option>)}</select>
              <select aria-label={`Plex filter ${index+1} operator`} value={filter.operator} onChange={event=>setVariableFilters(current=>current.map((item,i)=>i===index?{...item,operator:event.target.value}:item))}><option value="equals">equals</option><option value="not_equals">does not equal</option><option value="contains">contains</option><option value="not_contains">does not contain</option><option value="greater_than">is greater than</option><option value="less_than">is less than</option><option value="greater_than_or_equal">is at least</option><option value="less_than_or_equal">is at most</option><option value="truthy">has a value</option><option value="falsy">has no value</option></select>
              {!['truthy','falsy'].includes(filter.operator)?<input aria-label={`Plex filter ${index+1} value`} value={filter.value} onChange={event=>setVariableFilters(current=>current.map((item,i)=>i===index?{...item,value:event.target.value}:item))}/>:null}
              <button type="button" className="icon-button" aria-label={`Remove Plex filter ${index+1}`} onClick={()=>setVariableFilters(current=>current.filter((_,i)=>i!==index))}>×</button>
            </div>)}
            <div className="form-actions"><button type="button" className="secondary" onClick={()=>setVariableFilters(current=>[...current,{variable:'plex_days_since_added',operator:'greater_than_or_equal',value:'1'}])}>Add variable filter</button>{variableFilters.length?<button type="button" className="text-button" onClick={()=>setVariableFilters([])}>Clear filters</button>:null}</div>
          </fieldset>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={!selectedTemplate}
              onClick={() =>
                setSelectedTargets(
                  filteredEntries
                    .filter(compatible)
                    .map(targetKey),
                )
              }
            >
              Select filtered
            </button>
            <button type="button" className="secondary" disabled={!selectedTemplate} onClick={()=>setSelectedTargets(review.entries.filter(compatible).map(targetKey))}>Select entire matched library</button>
            <button
              type="button"
              className="secondary"
              disabled={!selectedTargets.length}
              onClick={() => setSelectedTargets([])}
            >
              Clear selection
            </button>
            <span className="badge green">
              {selectedTargets.length} selected
            </span>
            <span className="muted">
              Showing {visibleEntries.length} of {filteredEntries.length}
            </span>
          </div>
          <div className="plex-match-list" onScroll={event=>{const node=event.currentTarget;if(node.scrollTop+node.clientHeight>=node.scrollHeight-160)setVisibleLimit(value=>Math.min(value+100,filteredEntries.length));}}>
            {([['matched','Matched',visibleEntries.filter(item=>item.status==='matched')],['unmatched','Not matched',visibleEntries.filter(item=>item.status!=='matched')]] as const).map(([group,label,entries])=>entries.length?<section className="plex-match-group" key={group}>
              <h3><span>{label}</span><span className="badge">{entries.length}</span></h3>
              <div className="plex-match-group-items">{entries.map((item) => {
              const key = targetKey(item),
                canApply = compatible(item),
                selected = selectedTargets.includes(key);
              return (
                <label
                  className={`plex-match-row${selected ? " is-selected" : ""}${canApply ? "" : " is-disabled"}`}
                  key={key}
                >
                  <span className="plex-match-check">
                    <input
                      type="checkbox"
                      disabled={!canApply}
                      checked={selected}
                      aria-label={`Select ${item.title}`}
                      onChange={(event) =>
                        toggleTarget(key, event.target.checked)
                      }
                    />
                  </span>
                  <span className="plex-match-title">
                     <strong>
                       {item.title} {item.year ? `(${item.year})` : ""}
                     </strong>
                     {item.engineInstanceName ? <small>{item.engineInstanceName} → {item.plexLibrary.title}</small> : null}
                  </span>
                  <span
                    className={`plex-match-status badge${item.status === "matched" ? " green" : ""}`}
                  >
                    {item.status === "matched" ? "MATCHED" : "NOT MATCHED"}
                  </span>
                </label>
              );
            })}</div></section>:null)}
            {!visibleEntries.length ? (
              <div className="plex-match-empty">
                No library items match this search and status filter.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {selectedEntry && selectedTemplate ? (
        <div className="notice plex-application-review">
          <h3>
            {selectedEntries.length === 1
              ? "One-title application review"
              : `${selectedEntries.length}-title application review`}
          </h3>
          <p>
            The first selected title is shown below as a representative exact
            preview. VynodeArr captures a separate original poster and rollback
            record before changing every selected title.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,240px))",
              gap: 16,
              alignItems: "start",
            }}
          >
            <figure style={{ margin: 0 }}>
              <img
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: 240,
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: 12,
                }}
                src={previewUrl("original", selectedEntry)}
                alt={`Current Plex poster for ${selectedEntry.title}`}
              />
              <figcaption>Current Plex poster</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <img
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: 240,
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: 12,
                }}
                src={previewUrl("preview", selectedEntry)}
                alt={`Rendered overlay for ${selectedEntry.title}`}
              />
              <figcaption>Overlay preview</figcaption>
            </figure>
          </div>
          <button
            type="button"
            className="danger"
            disabled={busy || !selectedEntries.length}
            onClick={() => void apply()}
          >
            Capture rollback and apply{" "}
            {selectedEntries.length === 1
              ? "to Plex"
              : `${selectedEntries.length} posters`}
          </button>
        </div>
      ) : null}
      {applications.length ? (
        <details className="notice plex-history-panel">
          <summary className="plex-history-summary">
            <div>
              <h3>Plex poster change history</h3>
              <p className="muted">
                {applications.length} recent change{applications.length===1?"":"s"} · {restorableApplications.length} can be restored
              </p>
            </div>
            <span className="secondary">View history</span>
          </summary>
          <div className="plex-history-body"><p className="muted">VynodeArr captures the prior Plex poster before applying an overlay. Open this history only when you need to review or restore those changes.</p>
          <div className="plex-history-header">
            <div className="form-actions"><button type="button" className="danger" disabled={busy||!filteredRestores.length} onClick={()=>void restoreMany(filteredRestores)}>Restore filtered ({filteredRestores.length})</button><button type="button" className="danger" disabled={busy||!restorableApplications.length} onClick={()=>void restoreMany(restorableApplications)}>Restore all ({restorableApplications.length})</button>{applications.length>6?<button type="button" className="secondary" onClick={()=>setHistoryExpanded(value=>!value)}>{historyExpanded?"Show recent":"Show all"}</button>:null}</div>
          </div>
          <div className="plex-history-list">
            {(historyExpanded ? applications : applications.slice(0, 6)).map(
              (application) => (
                <article className="plex-history-card" key={application.id}>
                  <div className="plex-history-content">
                    <strong>{application.title}</strong>
                    <small>
                      {application.plexLibraryTitle} ·{" "}
                      {application.templateName}
                    </small>
                    <span
                      className={`badge${application.status === "applied" ? " green" : ""}`}
                    >
                      {application.status.toUpperCase()}
                    </span>
                  </div>
                  {application.status === "applied" ? (
                    <div className="form-actions">
                      <button type="button" className="danger" disabled={busy} onClick={() => void restore(application)}>Restore captured poster</button>
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div></div>
        </details>
      ) : null}
    </section>
  );
}
