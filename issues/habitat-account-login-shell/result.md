# Result

`site.json` `identities.login_shell` (`{"shell", "subjects"}`) names
operator-admitted GitHub subjects whose accounts get an interactive shell.
Host apply publishes it to the broker as root-only `login_shells.json` and
moves every committed account to its required shell with `usermod`: the
declared shell for named subjects, `/usr/sbin/nologin` for every other, so
removing a name reverts the account. The broker reads the declaration on
every account create and verification and accepts exactly that shell. No
broker request field, gateway or daemon path can choose a shell. Without the
file (every installation before this release) everything stays `nologin`.

Evidence: provision and host unit tests; root container
`scripts/test-host-initialization-uids.sh` with real
`useradd`/`usermod`/`getent`/`/etc/shells` (`TestLoginShellNativeAccounts`);
VM `./scripts/vm-test.sh host-runtime-admission` (real broker creates the
declared account with `/bin/bash`, the other with `nologin`; startup refuses
a bash account the declaration no longer names, then accepts it again once
it is back on `nologin`). Critical review: `/llm-review` + `/assess-findings`.
One must-fix was found and fixed: the declaration reader refused during the
writer's own pending transaction, and the first VM run had hit the same
failure.

## Decisions for later review

- **Accounts are named by GitHub subject, not username,** like admission and
  administrators. Each subject must also be in `identities.admission`
  (operator source). A person admitted only at runtime by a browser
  administrator cannot get a shell. This way, removing someone's admission in
  the site also removes their SSH, and a runtime withdrawal never leaves SSH
  open.
- **Shell choice:** any shell listed in `/etc/shells` whose whole path,
  including links, is root's and writable by no one else. `nologin` and
  `false` are refused as declarations.
- **Drift is fail-closed for the whole broker.** A named account whose shell
  differs from the declaration (changed by hand or with `chsh`) stops broker
  startup, as other account drift already does. Apply or root fixes it.
- **Sudo has to be a sudoers rule, not a group.** The broker has always
  refused Habitat accounts with supplementary groups, and that still holds.
  So Fleetrepo must grant Jari's sudo on Birch with an
  `/etc/sudoers.d/` rule naming `maintainer`, not
  `usermod -aG sudo`. Group membership would stop the broker.
- **Release upgrades do not publish the declaration.** The upgrade plan
  refuses (`upgrade.login_shell` / `login_shell_not_applied`) when the site
  declares a change that apply has not published. The order on Birch is:
  upgrade to this release with the site unchanged, then add `login_shell`
  and run `host apply`. An older operator binary refuses the new field.
- **Apply always writes the file,** even when it is empty, so a converged
  installation's broker state says explicitly that nobody is declared.
