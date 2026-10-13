# Pi session markers — partial implementation

Native initial model and thinking entries merge into a single quiet row; later changes and compaction use the same visual family, and session-name entries are hidden. The settled turn head now owns the work counts and fold; no trailing summary strip is rendered. `lab-old-markers-phone-dark.{png,html}`, `lab-thread-light.{png,html}`, and `lab-thread-phone-dark.{png,html}` are synthetic-lab captures.

The lab's old session only has a model-change entry, so its start row lacks a thinking level; the synthetic new conversation has an assistant model but no explicit start marker. Pi history currently supplies no thread duration in the browser's validated entry format, so the head does not display a duration for settled historical threads. Captures document that difference from the draft, not visual approval.

Unit tests cover merged start, later changes, compaction, hidden session name, and settled head. Focused web, browser-conversation (67/67), native-history (9/9), and shell accessibility (3/3) passed. This issue remains in progress until the duration and complete lab state are addressed.
