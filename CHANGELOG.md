# Changelog

## [0.2.1](https://github.com/ForumViriumHelsinki/dev-workflow-overview/compare/v0.2.0...v0.2.1) (2026-10-23)


### Bug Fixes

* **ci:** Publish the container image on release ([#26](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/26)) ([31ed07d](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/31ed07d844d7483e6c768fe1f549158636dc994a))
* **deps:** Update module github.com/bradleyfalzon/ghinstallation/v2 to v2.19.0 ([#29](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/29)) ([d6d3c3f](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/d6d3c3fe4b02627dec18c66393c21f45b3ddfa43))
* **deps:** Update module github.com/go-chi/chi/v5 to v5.5.0 ([#27](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/27)) ([0b9475f](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/0b9475f9243c289f68ae6a0925a572ac6977944d))
* **deps:** Update module github.com/prometheus/client_golang to v1.25.0 ([#12](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/12)) ([9a78a07](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/9a78a0796de1e56e5b7ee6d2ca5463a91d3fdc5c))


### Documentation

* Describe the security scans' current model and output ([#31](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/31)) ([608fdd2](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/608fdd22913247b8fb9e859bc2d1f36e79dd5939))

## [0.2.0](https://github.com/ForumViriumHelsinki/dev-workflow-overview/compare/v0.1.0...v0.2.0) (2026-08-28)


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
* **deps:** Update github.com/shurcool/githubv4 digest to 2402fdf ([#3](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/3)) ([d4bddeb](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/d4bddebf985a0aec930b592c3d21297376baa667))
* **deps:** Update module github.com/bradleyfalzon/ghinstallation/v2 to v2.18.0 ([#9](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/9)) ([f488415](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/f488415bef1e7356c2d8832632859964d1f8ee57))
* **deps:** Update module golang.org/x/sync to v0.20.0 ([#13](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/13)) ([a022b14](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/a022b14f4b1999319798407e360a86e6eb35b920))
* **deps:** Update module golang.org/x/sync to v0.21.0 ([#16](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/16)) ([e225eea](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/e225eea4d6da591ddaaa5c18a3aedfd1e31ff3ee))
* **web:** Stop pipeline from trapping page-level wheel scroll ([#1](https://github.com/ForumViriumHelsinki/dev-workflow-overview/issues/1)) ([d92b4aa](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/d92b4aab38b21d421c86240b2105fefa4fac7311))


### Documentation

* Add project blueprint, ADRs, PRDs, PRPs, and aggregator runbook ([7217be1](https://github.com/ForumViriumHelsinki/dev-workflow-overview/commit/7217be16d476ca5c19a952bce1c757e5679a8f56))
