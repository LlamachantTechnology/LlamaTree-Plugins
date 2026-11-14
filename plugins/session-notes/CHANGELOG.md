# Session notes

## 1.0.0

- First release: a page of notes per session, kept by the app, that a compaction or a new conversation can't lose. Its agent can keep them too, by messaging the plugin `save: …` and `read`, and a Claude session gets them back by itself after a compaction. Runs in the background, so it answers while its tab isn't open.
