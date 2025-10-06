import 'core-js/stable';
import 'regenerator-runtime';

import "webostvjs/webOSTV";

function lunaCall(uri, parameters) {
  return new Promise((resolve, reject) => {
    const s = uri.indexOf("/", 7);
    webOS.service.request(uri.substr(0, s), {
      method: uri.substr(s + 1),
      parameters,
      onSuccess: resolve,
      onFailure: (res) => {
        reject(new Error(JSON.stringify(res)));
      },
    });
  });
}

async function retry(attempt, cb) {
  while (true) {
    try {
      return await cb();
    } catch (err) {
      if (attempt--) {
        log (`An error occured, ${attempt} tries left...`);
        continue;
      }
      throw err;
    }
  }
}

function log(s) {
  document.querySelector('pre').innerText += `[${new Date()}] ${s}\n`;
}

(async () => {
  // always launch autostart first because even if we fail later,
  // at least everything will have started (including SSH)
  log("Launching autostart...");
  const res2 = await lunaCall('luna://org.webosbrew.hbchannel.service/autostart', {});
  log(`Result: ${res2.message}`);

  // now all that we want is ensuring that we get started on next boot,
  // all the logic below is here to ensure this is the case

  try {
    // unregister (always succeeds, even if we weren't registered),
    // then register the app in the real /var/lib/eim
    log('Unregistering ourselves as input app...');
    await lunaCall('luna://com.webos.service.eim/deleteDevice', {
      appId: 'org.webosbrew.autostart',
    });
  } catch (err) {
    log(`An error occurred, but carrying on:\n${err.stack}`);
  }

  try {
    log('Registering ourselves as input app...');
    await lunaCall('luna://com.webos.service.eim/addDevice', {
      appId: 'org.webosbrew.autostart',
      pigImage: '',
      mvpdIcon: '',
      type: 'MVPD_IP', // can be either MVPD_IP or MVPD_RF, required for webOS 3.x
      label: 'Autostart', // required for webOS 3.x
      description: 'webosbrew autostart', // required for webOS 3.x
    });
  } catch (err) {
    const errData = JSON.parse(err.message);
    if (errData.errorCode === 'EIM.105') { // input app already registered
      log('Already registered, good, carrying on...');
    }
    else {
      log(`An error occured:\n${err.stack}`);
      return;
    }
  }

  try {
    await retry(3, async () => {
      // now setup an eim overlay so that any changes done later don't erase our own app
      // if /var/lib/webosbrew/eim already exists, keep it that way, changes done in previous
      // sessions will live here, so just bind mount it, otherwise create it from the /var/lib/eim contents
      log('Setting up eim overlay...');
      const res = await lunaCall('luna://org.webosbrew.hbchannel.service/exec', {
        command: 'if [[ ! -d /var/lib/webosbrew/eim ]]; then cp -r /var/lib/eim /var/lib/webosbrew/eim && echo cp ok || echo cp failed; fi ; if ! findmnt /var/lib/eim; then mount --bind /var/lib/webosbrew/eim /var/lib/eim && echo mount overlay ok || echo mount overlay failed; fi',
      });
      log(`Result: ${res.stdoutString} ${res.stderrString}`);
    });

    // this just removes ourselves from the overlay, but we still live in the real /var/lib/eim,
    // which guarantees that we'll survive on the next reboot
    log("Removing our own input app from eim overlay...");
    await lunaCall('luna://com.webos.service.eim/deleteDevice', {
      appId: 'org.webosbrew.autostart',
    });

    // now be polite and launch the actual previous input app, if any
    log("Checking last input app...");
    const lastinput = await lunaCall('luna://org.webosbrew.hbchannel.service/exec', {
      command: 'cat /var/lib/eim/lastinput',
    });
    if (lastinput.stdoutString) {
      const lastinputPayload = JSON.parse(lastinput.stdoutString);
      if (lastinputPayload.appId) {
        log(`Last input app: ${lastinputPayload.appId}`);
        if (lastinputPayload.appId !== 'org.webosbrew.autostart') {
          log("Relaunching this app...");
          await lunaCall('luna://com.webos.service.applicationManager/launch', {
            id: lastinputPayload.appId,
          });
        }
      }
    }
    log("Done.");
  } catch (err) {
    log(`An error occured:\n${err.stack}`);
  }
})();
