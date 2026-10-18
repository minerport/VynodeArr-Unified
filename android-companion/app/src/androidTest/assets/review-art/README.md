# Visual test artwork

These Unsplash photographs illustrate fictional review titles. They are included only in the instrumentation test APK, never the companion APK. They are not movie artwork or screenshots of the user's library.

Source URLs (retrieved October 10, 2026, using `?auto=format&fit=crop&w=960&q=80`):

- https://images.unsplash.com/photo-1446776811953-b23d57bd21aa
- https://images.unsplash.com/photo-1518837695005-2083093ee35b
- https://images.unsplash.com/photo-1469474968028-56623f02e42e
- https://images.unsplash.com/photo-1470770841072-f978cf4d019e
- https://images.unsplash.com/photo-1519608487953-e999c86e7455
- https://images.unsplash.com/photo-1462331940025-496dfbfc7564

ReviewArtwork.kt intercepts only these fixture-host image requests during instrumentation, providing the saved photo bytes for deterministic rendering. Production image fetching and certificate validation are unchanged.
