# Visual acceptance

The browser offers creation, display-name settings, Git initialization, hide and restore. Deletion is visibly unavailable pending the native cleanup adapter. The controls use shared ControlButton styling. Synthetic lab captures show the [home creation form](lifecycle-home.avif) ([inert HTML](lifecycle-home.html)) and the [workspace settings and deletion notice](lifecycle-detail.avif) ([inert HTML](lifecycle-detail.html)). These are synthetic Alice views, not real user data.

Component tests cover create and hide, and the clean gate passes synthetic browser regressions. The synthetic host does not mount the lifecycle write route, so these captures do **not** demonstrate a successful host-backed lifecycle mutation. Jari's visual verdict remains outstanding after deployment and does not block functional completion.
