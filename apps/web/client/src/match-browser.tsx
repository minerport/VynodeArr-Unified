import { useEffect, useState, type FormEvent } from "react";
import {errorMessage} from "./shell-utils";

export interface MatchCandidate { tmdbId: number; imdbId?: string; title: string; year?: number; overview?: string; poster?: string }
interface Props { domain: "movie" | "tv"; title: string; busy: boolean; request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>; onClose: () => void; onApply: (candidate: MatchCandidate) => Promise<void> }
const message = (reason: unknown) => errorMessage(reason, "External ID search failed.");

export function MatchBrowser({ domain, title, busy, request, onClose, onApply }: Props) {
  const [term, setTerm] = useState(title), [items, setItems] = useState<MatchCandidate[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const search = async (event?: FormEvent) => {
    event?.preventDefault(); const query = term.trim(); if (!query) return; setLoading(true); setError("");
    try {
      if (/^tt\d+$/i.test(query)) {
        const imdbId = query.toLowerCase(), value = await request<{ result: MatchCandidate[] }>(`/api/manage/${domain}/lookup?term=${encodeURIComponent(`imdb:${imdbId}`)}`), match = (value.result || []).find(item => String(item.imdbId || "").toLowerCase() === imdbId);
        setItems(match ? [{ ...match, tmdbId: 0, imdbId }] : []);
      } else if (/^\d+$/.test(query)) {
        const value = await request<{ item: MatchCandidate }>(`/api/discover/details/${domain}/${encodeURIComponent(query)}`); setItems(value.item ? [value.item] : []);
      } else {
        const value = await request<{ results: MatchCandidate[] }>(`/api/discover/browse?domain=${domain}&query=${encodeURIComponent(query)}&page=1`); setItems((value.results || []).slice(0, 20));
      }
    } catch (reason) { setItems([]); setError(message(reason)); } finally { setLoading(false); }
  };
  const apply = async (candidate: MatchCandidate) => { setError(""); try { await onApply(candidate); } catch (reason) { setError(message(reason)); } };
  useEffect(() => { void search(); }, []);
  return <dialog open className="react-detail-dialog match-browser"><div className="panel-heading"><div><span className="eyebrow">CORRECT EXTERNAL ID MATCH</span><h2>Correct {title}</h2><p className="muted">Search by title, TMDB ID, or IMDb ID. The selected external identity will be applied while existing files and library settings are retained.</p></div><button className="secondary" onClick={onClose}>Close</button></div><form className="match-search" onSubmit={event => void search(event)}><input value={term} onChange={event => setTerm(event.target.value)} aria-label="Search by title, TMDB ID, or IMDb ID" placeholder="Title, TMDB ID, or tt IMDb ID"/><button className="primary" disabled={loading || busy}>{loading ? "Searching…" : "Search"}</button></form>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="match-results">{!loading && !items.length ? <div className="empty compact"><p>No matches found.</p></div> : items.map(candidate => <article className="match-result" key={candidate.imdbId || candidate.tmdbId}>{candidate.poster ? <img src={candidate.poster} alt="" loading="lazy"/> : <span className="art-fallback">ID</span>}<div><h3>{candidate.title} {candidate.year ? <small>{candidate.year}</small> : null}</h3><p>{candidate.overview || "No overview available."}</p><small>{candidate.imdbId ? `IMDb ${candidate.imdbId}` : `TMDB ${candidate.tmdbId}`}</small></div><button className="secondary" disabled={busy} onClick={() => void apply(candidate)}>{busy ? "Updating engine…" : "Use this ID"}</button></article>)}</div></dialog>;
}
