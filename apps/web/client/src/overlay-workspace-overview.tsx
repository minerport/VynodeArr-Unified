type Workspace = "overview" | "templates" | "assignments" | "plex";

export default function OverlayWorkspaceOverview({
  templateCount,
  vynodeCount,
  plexCount,
  assignmentCount,
  onNavigate,
}: {
  templateCount: number;
  vynodeCount: number;
  plexCount: number;
  assignmentCount: number;
  onNavigate: (workspace: Workspace) => void;
}) {
  return <div className="overlay-overview">
    <section className="panel overlay-introduction">
      <span className="eyebrow">START HERE</span>
      <h2>Choose what you want to change</h2>
      <p>VynodeArr overlays change only the posters displayed in this app. Plex templates create managed Plex artwork and capture the previous poster so it can be restored.</p>
      <div className="overlay-destination-guide">
        <article><strong>VynodeArr display</strong><p>Stack one or more styles without changing files or artwork stored in Plex.</p><button className="secondary" type="button" onClick={()=>onNavigate("assignments")}>Manage assignments</button></article>
        <article><strong>Plex artwork</strong><p>Review matched titles before applying artwork, then use poster history when a rollback is needed.</p><button className="secondary" type="button" onClick={()=>onNavigate("plex")}>Manage Plex artwork</button></article>
      </div>
    </section>
    <section className="overlay-overview-stats" aria-label="Overlay status">
      <button type="button" className="panel" onClick={()=>onNavigate("templates")}><strong>{templateCount}</strong><span>Saved templates</span><small>{vynodeCount} VynodeArr · {plexCount} Plex</small></button>
      <button type="button" className="panel" onClick={()=>onNavigate("assignments")}><strong>{assignmentCount}</strong><span>Active assignments</span><small>Styles currently used inside VynodeArr</small></button>
    </section>
    <section className="panel overlay-workflow-guide">
      <div><span>1</span><strong>Choose a destination</strong><small>VynodeArr display or managed Plex artwork.</small></div>
      <div><span>2</span><strong>Build a template</strong><small>Add layers, conditions, icons, and live metadata.</small></div>
      <div><span>3</span><strong>Choose its scope</strong><small>Select a library, collection, rules, or specific titles.</small></div>
      <div><span>4</span><strong>Preview and apply</strong><small>Confirm the exact result before artwork changes.</small></div>
    </section>
  </div>;
}
