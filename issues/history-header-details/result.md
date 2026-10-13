# Header details — partial implementation

The header now has balanced status-chip padding, a model/thinking chip, and an aligned facts popover. Disabled reasons stay on their controls. The old read-only view shows a recap card above its footer when the native recap endpoint reports messages, including a prompt if no recap exists. `lab-old-details-{light,phone-dark}.{png,html}` and `lab-details-{light,dark}.{png,html}` are synthetic-lab captures, not live-host proof.

Compared with the draft, the host history contract does not expose the native session start time or a workspace path; these are reported as unavailable instead of invented. A session without native thinking-level entries shows an unknown thinking level. On phone the model text in the chip is hidden to keep the action bar usable; the full id remains in details. The recap for a read-only old conversation cannot be regenerated without continuing it.

Focused web checks passed (112 app/unit tests, 98 component tests); browser-conversation 67/67, native-history 9/9 and shell-accessibility 3/3 passed in the synthetic host. This issue remains in progress pending the full agreed facts and final review.
