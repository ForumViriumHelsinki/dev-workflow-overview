// Package github adapts GitHub API data into stage payloads. It
// populates stages 1, 3, 4, 5, 6, 7, 10, 12, 14 per PRP-002 §4.3.
// Authentication is via a GitHub App installation token using the
// bradleyfalzon/ghinstallation/v2 transport; the GraphQL batched query
// keeps per-app API cost to a single round-trip.
package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/bradleyfalzon/ghinstallation/v2"
	gh "github.com/google/go-github/v64/github"
	"github.com/shurcooL/githubv4"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// Config is the minimum set of credentials required for the adapter.
type Config struct {
	AppID          int64
	InstallationID int64
	PrivateKeyPEM  []byte
	Org            string
	BaseURL        string // optional; defaults to api.github.com via go-github.
}

// Adapter is the GitHub stage adapter.
type Adapter struct {
	rest    *gh.Client
	graphql *githubv4.Client
	cfg     Config

	// RateLimitRemaining is updated after every REST call; exposed as a
	// Prometheus gauge by the caller.
	RateLimitRemaining *int
}

// New wires the installation transport and returns an Adapter.
func New(cfg Config) (*Adapter, error) {
	if cfg.AppID == 0 || cfg.InstallationID == 0 || len(cfg.PrivateKeyPEM) == 0 {
		return nil, errors.New("github: AppID, InstallationID, PrivateKeyPEM are required")
	}
	tr, err := ghinstallation.New(http.DefaultTransport, cfg.AppID, cfg.InstallationID, cfg.PrivateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("ghinstallation: %w", err)
	}
	httpClient := &http.Client{Transport: tr, Timeout: 15 * time.Second}
	return &Adapter{
		rest:    gh.NewClient(httpClient),
		graphql: githubv4.NewClient(httpClient),
		cfg:     cfg,
	}, nil
}

// Fetch returns a StageUpdates map populated from one GraphQL query
// plus a single REST call for Checks (Checks API is REST-only).
func (a *Adapter) Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error) {
	if a == nil {
		return nil, errors.New("github: adapter not configured")
	}
	owner, repo, ok := splitRepo(ref.Repo)
	if !ok {
		return nil, fmt.Errorf("github: invalid repo %q", ref.Repo)
	}

	data, err := a.fetchGraphQL(ctx, owner, repo)
	if err != nil {
		return nil, err
	}

	out := domain.StageUpdates{}
	now := time.Now().UTC().Format(time.RFC3339)

	out[domain.StageInception] = buildInception(data, now)
	out[domain.StageDevelop] = buildDevelop(data, now)
	out[domain.StageCommitPush] = buildCommitPush(data, now)
	out[domain.StageAIReview] = buildAIReview(data, now)
	out[domain.StageRelease] = buildRelease(data, now)
	out[domain.StageOperate] = buildOperate(data, now)
	out[domain.StageEvolve] = buildEvolve(data, now)
	out[domain.StageDecommission] = buildDecommission(data, now)

	// CI Gates — one REST Checks call against the default branch HEAD.
	if data.DefaultBranchSHA != "" {
		checks, _, err := a.rest.Checks.ListCheckRunsForRef(
			ctx, owner, repo, data.DefaultBranchSHA, nil,
		)
		if err == nil && checks != nil {
			out[domain.StageCIGates] = buildCIGates(checks.CheckRuns, data.DefaultBranchSHA, now)
		}
		// Update rate-limit gauge from the most recent REST response.
		if rl, _, err := a.rest.RateLimit.Get(ctx); err == nil && rl != nil {
			if rl.Core != nil {
				remaining := rl.Core.Remaining
				a.RateLimitRemaining = &remaining
			}
		}
	}

	return out, nil
}

func splitRepo(r string) (owner, repo string, ok bool) {
	parts := strings.SplitN(r, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}
