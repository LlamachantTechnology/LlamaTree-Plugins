# LlamaTree plugins

The plugins for [LlamaTree](https://github.com/LlamachantTechnology/LlamaTree), one folder each under [`plugins/`](plugins). A plugin is a web page shown in a tab or in the side panel; it runs sandboxed on an address of its own and sees nothing of your sessions until you allow what its manifest asks for.

## The plugins

<!-- plugins:start -->
| Plugin | What it does | Version | Shows in | Asks to see |
|---|---|---|---|---|
| [Messenger](plugins/messenger) | Send a message to a Claude or Codex session and see the answers, or the messages sessions send it | [1.0.0](https://github.com/LlamachantTechnology/LlamaTree-Plugins/releases/tag/messenger-v1.0.0) | the side panel | message |
<!-- plugins:end -->

The table is written by `node tools/catalog.mjs --readme` from each plugin's `plugin.json`; the version links to its release.

## Installing one

1. Open the plugin's release (the version in the table) and download `<id>-<version>.zip`.
2. In LlamaTree, click the palette button at the top right and choose **Open the plugins folder**.
3. Unzip into that folder, so it holds `plugins\<id>\plugin.json`.
4. Open the palette menu again: the plugin is listed under **Plugins**. The first time it wants to see anything, the app asks you.

LlamaTree will soon list these plugins itself under *Get plugins…* and install them from here, reading [`catalog.json`](https://github.com/LlamachantTechnology/LlamaTree-Plugins/releases/tag/catalog), which the release workflow rebuilds after every release.

## Writing one

See [CONTRIBUTING.md](CONTRIBUTING.md): the folder layout, the manifest ([`schema/plugin.schema.json`](schema/plugin.schema.json)), the checks (`node tools/validate.mjs`), and how a plugin is released (a tag `<id>-v<version>` on `main`).

## Licence

Apache License 2.0, the same as LlamaTree: see [LICENSE](LICENSE) and [NOTICE](NOTICE).
