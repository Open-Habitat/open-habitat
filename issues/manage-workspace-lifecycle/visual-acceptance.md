# Visual acceptance

The browser now offers creation, display-name settings, Git initialization, hide and restore. Deletion is visibly unavailable pending the native cleanup adapter. The new controls use shared ControlButton styling. Unit tests cover create and hide; the clean gate runs synthetic browser regressions, but the synthetic browser host does not yet mount the lifecycle write route. There is no screenshot/HTML pair demonstrating a successful host-backed lifecycle journey. Jari's visual verdict is outstanding after deployment and does not block merging.
