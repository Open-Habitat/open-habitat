# Result

The chip dropped nothing on the way from the daemon: Jari's view list on
Birch (171 views, below the 200 cap) held all six views of the conversation.
The browser's `assetEntries` folded views into one row by entry file name
alone. Worktree-lista, Keskusteluarkisto and Jaot omaan paikkaan all export
`offline.html`, so they became one row under the newest (Jaot), and
Keskusteluarkisto was shown only as a hidden "older version" of another
report. Size, history window, restart and the file-offer list were not
involved.

Rows now fold only views with the same title and the same entry file. A
unit test with the conversation's real six views (including the same
report offered again on 9.11.) fails on the old rule and passes on the new.

## Decisions for later review

- **What is "the same report" for version folding.** Chosen: same title and
  same entry file. Alternatives: the export's source path (workspace +
  path), which is exact but needs a contract and daemon change in a hotfix;
  or no folding at all. Why: an agent offering the same report again keeps
  its title, and different reports almost always differ in title; a report
  whose title changes between rounds now shows as separate rows, which loses
  nothing.
- **The person-wide 200-view cap** will hide older conversations' views
  from their chip once a person has more views (Jari has 171). It is not
  this report's cause and needs a contract change, so it is filed separately
  as `assets-chip-view-list-cap` instead of riding in the hotfix.
