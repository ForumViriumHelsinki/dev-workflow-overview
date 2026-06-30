# Changelog

## [0.2.0](https://github.com/ForumViriumHelsinki/dev-workflow-overview/compare/v0.1.0...v0.2.0) (2026-06-30)


### Features

* **aggregator:** Add Go status-aggregator service for live deployment status ([bed304e](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/bed304e74980629ea053b9fd47eef233fd5693bd))
* **aggregator:** Close Phase C validation and embed dist for same-origin serving ([1eb3435](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/1eb3435dec2527d78f31f88cd18dbb4d297f28a9))
* **aggregator:** Wire live ArgoCD + Kubernetes adapters via composite source ([648c270](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/648c270a589aee788bd4e011b44dfd1121d90a57))
* **deps:** Adopt config:recommended + enable lockFileMaintenance ([#17](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/17)) ([10c885e](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/10c885eeda49d4bc6f961cc8bcd3d7c33323fb2e))
* **dev:** Add k8s manifests, skaffold, and justfile for local kind loop ([4211296](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/4211296b4b251490f5a80af28ef6a9282de4f167))
* Expand workflow overview to full project lifecycle ([ddbf86f](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/ddbf86f98e1c3b71209a1f7700e3a06a27abc8fe))
* Initial dev workflow overview visualization ([15b521c](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/15b521c8f752cd4f988e9e3c8e625345ccce80bf))
* **web:** Add live-mode wiring with SSE status client and UI integration ([9f36f6f](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/9f36f6fefd01824bfa876b29ec6a3c2010e6e591))


### Bug Fixes

* **aggregator:** Preserve http.Flusher through middleware for SSE ([1f33946](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/1f33946f43e5a3a7e8fed8ac00800f314b9d4dbe))
* **ci:** Pass api.Deps by pointer; refresh bun.lock for @playwright/test ([79001b3](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/79001b387a0ceca9eea72a8e763ae319ecf0e1bb))
* **deps:** Update module golang.org/x/sync to v0.20.0 ([#13](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/13)) ([a022b14](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/a022b14f4b1999319798407e360a86e6eb35b920))
* **deps:** Update module golang.org/x/sync to v0.21.0 ([#16](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/16)) ([e225eea](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/e225eea4d6da591ddaaa5c18a3aedfd1e31ff3ee))
* **web:** Stop pipeline from trapping page-level wheel scroll ([#1](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/1)) ([d92b4aa](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/d92b4aab38b21d421c86240b2105fefa4fac7311))


### Documentation

* Add project blueprint, ADRs, PRDs, PRPs, and aggregator runbook ([7217be1](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/7217be16d476ca5c19a952bce1c757e5679a8f56))
