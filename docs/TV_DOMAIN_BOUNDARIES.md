# TV domain boundaries

The TV domain owns series, alternate titles, series type, seasons, episodes,
specials, monitoring at three levels, future/missing/cutoff policies, metadata,
episode files, season folders, naming, parsing, release search, scan/import/
rename decisions, and episodic wanted calculations.

Core persistence entities identified in review include Series, Season,
Episode, EpisodeFile, AlternateTitle, SceneMapping/numbering metadata,
QualityProfile, CustomFormat, RootFolder, History, Blocklist, ImportList, and
domain command state. Multi-episode files intentionally relate one file to
multiple episodes.

Behavioral cases include standard, daily, and anime parsing; absolute, scene,
and alternate numbering; specials; unaired/future monitoring; season-pass
changes; series-wide, season, or episode search; and partial-season progress.
