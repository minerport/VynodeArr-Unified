import { useEffect, useRef } from "react";

export type ServiceSection =
  | "root-folders"
  | "library-health"
  | "library-review"
  | "media-management"
  | "poster-overlays"
  | "profiles"
  | "custom-formats"
  | "guide-templates"
  | "release-profiles"
  | "indexers"
  | "download-clients"
  | "import-lists"
  | "discover"
  | "music"
  | "subtitles"
  | "advanced";

type ServiceGroup = "Library" | "Quality & automation" | "Connections" | "Application";
const tabs: Array<{ section: ServiceSection; label: string; href: string; group: ServiceGroup }> = [
  {
    section: "root-folders",
    label: "Root Folders",
    href: "#service/root-folders",
    group: "Library",
  },
  {
    section: "library-health",
    label: "Library Health",
    href: "#service/library-health",
    group: "Library",
  },
  {
    section: "library-review",
    label: "Library Review",
    href: "#service/library-review",
    group: "Library",
  },
  {
    section: "media-management",
    label: "Media Management",
    href: "#service/media-management",
    group: "Library",
  },
  {
    section: "poster-overlays",
    label: "Overlays",
    href: "#service/poster-overlays",
    group: "Library",
  },
  { section: "profiles", label: "Quality Profiles", href: "#service/profiles", group: "Quality & automation" },
  {
    section: "custom-formats",
    label: "Custom Formats",
    href: "#service/custom-formats",
    group: "Quality & automation",
  },
  {
    section: "guide-templates",
    label: "Guide Templates",
    href: "#service/guide-templates",
    group: "Quality & automation",
  },
  {
    section: "release-profiles",
    label: "Release Profiles",
    href: "#service/release-profiles",
    group: "Quality & automation",
  },
  { section: "indexers", label: "Indexers", href: "#service/indexers", group: "Connections" },
  {
    section: "download-clients",
    label: "Download Clients",
    href: "#service/download-clients",
    group: "Connections",
  },
  {
    section: "import-lists",
    label: "Import Lists",
    href: "#service/import-lists",
    group: "Connections",
  },
  { section: "discover", label: "Discover", href: "#service/discover", group: "Connections" },
  { section: "music", label: "Music Setup", href: "#service/music", group: "Application" },
  { section: "subtitles", label: "Subtitles", href: "#service/subtitles", group: "Application" },
  { section: "advanced", label: "Advanced", href: "#management", group: "Application" },
];

export function ServiceTabs({
  active,
  onNavigate,
}: {
  active: ServiceSection;
  onNavigate?: (section: ServiceSection) => void;
}) {
  const activeTab = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const target=activeTab.current,parent=target?.parentElement;
    if(!target||!parent||parent.scrollWidth<=parent.clientWidth)return;
    const centered=target.offsetLeft-(parent.clientWidth-target.clientWidth)/2;
    parent.scrollTo({left:Math.max(0,centered),behavior:"auto"});
  }, [active]);
  return (
    <nav className="settings-tabs service-settings-tabs" aria-label="Service settings">
      <label className="service-settings-picker">
        <span>Service settings page</span>
        <select value={active} onChange={event=>{
          const tab=tabs.find(item=>item.section===event.target.value);
          if(tab){onNavigate?.(tab.section);window.location.hash=tab.href.slice(1);}
        }}>
          {(["Library","Quality & automation","Connections","Application"] as ServiceGroup[]).map(group=><optgroup label={group} key={group}>{tabs.filter(tab=>tab.group===group).map(tab=><option value={tab.section} key={tab.section}>{tab.label}</option>)}</optgroup>)}
        </select>
      </label>
      {tabs.map((tab) => (
        <a
          className={tab.section === active ? "active" : undefined}
          href={tab.href}
          key={tab.section}
          ref={tab.section === active ? activeTab : undefined}
          onClick={() => onNavigate?.(tab.section)}
          aria-current={tab.section === active ? "page" : undefined}
          data-group={tab.group}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
