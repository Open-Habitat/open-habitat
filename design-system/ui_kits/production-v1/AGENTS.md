# Production v1 review kit

`index.html` is a static, non-runtime design correction artifact for the production
v1 specification. It uses `../../styles.css` and intentionally contains no mock
backend behavior. The canonical interaction and component contracts are
[`../../production-v1.md`](../../production-v1.md) and
[`../../component-catalog-v1.md`](../../component-catalog-v1.md).

Keep this kit reviewable without a build. Do not add simulated timers, network
calls, command success, or copies of received source deliveries.
