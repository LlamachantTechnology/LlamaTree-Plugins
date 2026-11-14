# Session notes

A page of notes for each session, kept outside its conversation, so a compaction (a summary in place of the conversation) or a new conversation can't lose them. You write them, the session's agent can keep them as it works, and they're given back to it when it needs them. It shows in the side panel, beside Git Changes.

## Using it

- **Open it** from the palette button, under **Plugins**, or right-click a session's tab (or open its ⋯ menu) and choose **Session notes**. It shows the notes of the session you have open, and follows you as you open another; the picker at the top chooses one.
- **Write your own:** type in the page and **Save** (or <kbd>Ctrl</kbd>+<kbd>S</kbd>).
- **Have the agent keep them:** tick **Have this session's agent keep notes here**. The plugin sends the agent a message asking it to save a note whenever a piece of work is finished, a decision is made or the task changes. The agent saves one by messaging the plugin `save: <note>`, and gets them all back with `read`. Each note is added as a line with its date and time, and you can edit them like your own.
- **After a compaction:** once a Claude session's conversation has been compacted, the plugin sends it its notes by itself. Other agents (Codex, Antigravity, Grok) are asked to send `read` after a compaction, since the plugin can't see theirs.

It runs in the background from when LlamaTree opens (`background`), so the agent's messages are answered while its tab isn't open. It only runs while LlamaTree's window is open; messages sent while it's closed wait for it.

## What it asks to see

- `sessions`: the list of your sessions, to show and follow the one you have open, and Claude sessions' activity, to see when a conversation has been compacted.
- `message`: to ask an agent to keep notes, and to answer its `save:` and `read` messages (`inbox`, so sessions may message it first).

The app asks you before it may do either, and you choose the projects whose sessions it sees. You can change your answers under **Permissions**.

## Where the notes are kept

In LlamaTree's data folder, `plugin-data\session-notes.json`, kept by the app for this plugin alone. Removing the plugin from **Get plugins** deletes them. Notes of a session you've removed stay until then, but aren't shown.

Needs LlamaTree 1.3.5 or later, for `background` and for keeping data.

## Files

`index.html` is the page, `notes.js` its script, `icon.svg` its icon. Everything is inside this folder; nothing is loaded from the network.
