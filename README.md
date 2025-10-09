webosbrew-autostart
===================

This is a minimal webosbrew Homebrew Channel autostart application relying on
"Input Apps" functionality.

* Registers itself as an input app - this makes the app launch on next boot
* Binds mounts over /var/lib/eim (where last input app/eligible input apps are
  stored) to an alternative path, so input app changes will not be replace
  webosbrew-autostart in original storage directory. *This is the crucial part
  that makes this work on every reboot.*
* Launches luna://org.webosbrew.hbchannel.service/autostart (which runs as
  root and executes all startup hooks/services)
* Removes itself from an input app list to reduce annoyance - this will only
  modify our overlay, *not* the underlying storage.
* If last input app in alternative storage is not our autostart app -
  automatically launch last running app

**Note:** This is a complete rewrite of https://github.com/kopiro/webosbrew-autostart

**Note2:** This repo is a fork of the abovementioned rewrite.
It enhances compatibility with some webOS versions (well, at least mine: webOS 3.4),
see [this issue](https://github.com/webosbrew/webos-homebrew-channel/issues/124#issuecomment-3372904638) for more context.

Building
--------

```sh
npm install

npm run build
npm run package

# Configure development TV/emulator
node_modules/.bin/ares-setup-device ...

npm run deploy
npm run launch
```
