package github

import (
	"context"
	"time"

	"github.com/shurcooL/githubv4"
)

// repoPayload is the intermediate struct the adapter reduces the GraphQL
// response into. Keeping it plain makes the per-stage builders simple
// and lets tests hand-craft fixtures without touching githubv4 types.
type repoPayload struct {
	DefaultBranch    string
	DefaultBranchSHA string
	Archived         bool
	LastCommit       *commit
	CommitsLast7d    int
	CommitsLast30d   int
	OpenPullRequests int
	LastNCommits     []commit
	LatestOpenPR     *pullRequest
	LatestRelease    *release
	ReleasePleasePR  *pullRequest
	HasRunbook       bool
	RunbookPath      string
	RunbookURL       string
	MigrationIssues  int
	BreakingIssues   int
	OpenIssueCount   int
	OldestIssueAt    *time.Time
	LatestIssueAt    *time.Time
	ProjectLabels    []string
}

type commit struct {
	SHA       string
	Message   string
	Author    string
	Committed time.Time
}

type pullRequest struct {
	Number   int
	URL      string
	Title    string
	Author   string
	OpenedAt time.Time
}

type release struct {
	TagName     string
	PublishedAt time.Time
	URL         string
}

// repoQuery is the single GraphQL round-trip populating one app snapshot.
// Named fields use githubv4 struct tags so the client produces a
// well-formed query. Query cost stays under 50 points per run.
type repoQuery struct {
	Repository struct {
		IsArchived       bool
		DefaultBranchRef struct {
			Name   string
			Target struct {
				Commit struct {
					Oid     string
					History struct {
						TotalCount int
					} `graphql:"history(since:$since)"`
				} `graphql:"... on Commit"`
			}
		}
		PullRequests struct {
			TotalCount int
			Nodes      []struct {
				Number int
				URL    string
				Title  string
				Author struct {
					Login string
				}
				CreatedAt time.Time
				HeadRefName string
			}
		} `graphql:"pullRequests(states:OPEN,first:10,orderBy:{field:CREATED_AT,direction:DESC})"`
		Releases struct {
			Nodes []struct {
				TagName     string
				PublishedAt time.Time
				URL         string
			}
		} `graphql:"releases(first:1,orderBy:{field:CREATED_AT,direction:DESC})"`
		Issues struct {
			TotalCount int
			Nodes      []struct {
				CreatedAt time.Time
				UpdatedAt time.Time
			}
		} `graphql:"issues(states:OPEN,first:10,orderBy:{field:CREATED_AT,direction:ASC})"`
		Labels struct {
			Nodes []struct {
				Name string
			}
		} `graphql:"labels(first:50,query:\"project:\")"`
		MigrationIssues struct {
			TotalCount int
		} `graphql:"migration: issues(states:OPEN,labels:[\"migration\"])"`
		BreakingChangeIssues struct {
			TotalCount int
		} `graphql:"breakingChange: issues(states:OPEN,labels:[\"breaking-change\"])"`
		Runbook struct {
			Typename string `graphql:"__typename"`
		} `graphql:"runbook: object(expression:\"HEAD:docs/RUNBOOK.md\")"`
	} `graphql:"repository(owner:$owner, name:$name)"`
}

func (a *Adapter) fetchGraphQL(ctx context.Context, owner, name string) (repoPayload, error) {
	var q repoQuery
	since := time.Now().AddDate(0, 0, -30)
	vars := map[string]any{
		"owner": githubv4.String(owner),
		"name":  githubv4.String(name),
		"since": githubv4.GitTimestamp{Time: since},
	}
	if err := a.graphql.Query(ctx, &q, vars); err != nil {
		return repoPayload{}, err
	}

	p := repoPayload{
		DefaultBranch:    q.Repository.DefaultBranchRef.Name,
		DefaultBranchSHA: q.Repository.DefaultBranchRef.Target.Commit.Oid,
		Archived:         q.Repository.IsArchived,
		CommitsLast30d:   q.Repository.DefaultBranchRef.Target.Commit.History.TotalCount,
		OpenPullRequests: q.Repository.PullRequests.TotalCount,
		MigrationIssues:  q.Repository.MigrationIssues.TotalCount,
		BreakingIssues:   q.Repository.BreakingChangeIssues.TotalCount,
		OpenIssueCount:   q.Repository.Issues.TotalCount,
		HasRunbook:       q.Repository.Runbook.Typename != "",
	}
	if p.HasRunbook {
		p.RunbookPath = "docs/RUNBOOK.md"
		p.RunbookURL = "https://github.com/" + owner + "/" + name + "/blob/" + p.DefaultBranch + "/docs/RUNBOOK.md"
	}
	for _, l := range q.Repository.Labels.Nodes {
		p.ProjectLabels = append(p.ProjectLabels, l.Name)
	}
	if len(q.Repository.Issues.Nodes) > 0 {
		first := q.Repository.Issues.Nodes[0].CreatedAt
		last := q.Repository.Issues.Nodes[len(q.Repository.Issues.Nodes)-1].UpdatedAt
		p.OldestIssueAt = &first
		p.LatestIssueAt = &last
	}
	if len(q.Repository.Releases.Nodes) > 0 {
		r := q.Repository.Releases.Nodes[0]
		p.LatestRelease = &release{
			TagName:     r.TagName,
			PublishedAt: r.PublishedAt,
			URL:         r.URL,
		}
	}
	for _, pr := range q.Repository.PullRequests.Nodes {
		if containsFold(pr.Title, "chore: release") || containsFold(pr.HeadRefName, "release-please") {
			p.ReleasePleasePR = &pullRequest{
				Number:   pr.Number,
				URL:      pr.URL,
				Title:    pr.Title,
				Author:   pr.Author.Login,
				OpenedAt: pr.CreatedAt,
			}
		}
		if p.LatestOpenPR == nil {
			p.LatestOpenPR = &pullRequest{
				Number:   pr.Number,
				URL:      pr.URL,
				Title:    pr.Title,
				Author:   pr.Author.Login,
				OpenedAt: pr.CreatedAt,
			}
		}
	}
	return p, nil
}

// containsFold reports whether needle is a case-insensitive substring of
// hay. Small helper local to this package so callers can keep importing
// only domain + time.
func containsFold(hay, needle string) bool {
	H := toLower(hay)
	N := toLower(needle)
	for i := 0; i+len(N) <= len(H); i++ {
		if H[i:i+len(N)] == N {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		b[i] = c
	}
	return string(b)
}
