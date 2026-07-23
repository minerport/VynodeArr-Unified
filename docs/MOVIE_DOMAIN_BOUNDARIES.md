# Movie domain boundaries

The Movie domain owns movie records, alternate titles, minimum availability,
monitoring, metadata/credits, collections, movie files and extras, folder and
file naming, parsing, quality decisions, release search, scan/import/rename/
replacement decisions, missing and cutoff-unmet calculations, and collection
or import-list membership effects.

Core persistence entities identified in the review include Movie, MovieFile,
AlternativeTitle, Collection, CollectionMovie, Credit, ExtraFile, ImportList,
ImportListExclusion, QualityProfile, CustomFormat, RootFolder, History,
Blocklist, and domain command state. Exact source schemas are not public
contracts and are not copied into N1.

Edge policies include availability gates, editions, multiple cuts, collection
monitoring, existing-file replacement, free-space and permissions failures,
remote-path mapping, failed-download rejection, and safe record deletion
separate from file deletion.
