package github

import (
	"fmt"
	"time"

	gh "github.com/google/go-github/v64/github"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// Each builder takes the decoded GraphQL payload (or the REST Checks
// list in the CI Gates case), plus a UTC "now" string, and returns the
// fully populated domain.Stage.

func buildInception(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        1,
		Kind:      domain.StageInception,
		Phase:     domain.PhaseSetup,
		Title:     "Inception",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		Details: map[string]any{
			"openIssueCount":  p.OpenIssueCount,
			"oldestOpenedAt":  p.OldestIssueAt,
			"latestUpdatedAt": p.LatestIssueAt,
			"projectLabels":   p.ProjectLabels,
		},
	}
	switch {
	case p.OpenIssueCount == 0 && len(p.ProjectLabels) == 0:
		st.Status = domain.StatusUnknown
		st.Summary = "No tracked work items"
	case p.OpenIssueCount > 0:
		st.Status = domain.StatusOK
		st.Summary = fmt.Sprintf("%d open issues", p.OpenIssueCount)
	default:
		st.Status = domain.StatusOK
		st.Summary = "Labelled in org roadmap"
	}
	return st
}

func buildDevelop(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        3,
		Kind:      domain.StageDevelop,
		Phase:     domain.PhaseBuild,
		Title:     "Develop",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		Details: map[string]any{
			"commitsLast7d":    p.CommitsLast7d,
			"commitsLast30d":   p.CommitsLast30d,
			"openPullRequests": p.OpenPullRequests,
		},
	}
	switch {
	case p.CommitsLast7d >= 1:
		st.Status = domain.StatusOK
		st.Summary = fmt.Sprintf("%d commits in last 7 days", p.CommitsLast7d)
	case p.CommitsLast30d >= 1:
		st.Status = domain.StatusWarn
		st.Summary = "No commits in last 7 days"
	default:
		st.Status = domain.StatusFail
		st.Summary = "No commits in last 30 days"
	}
	return st
}

func buildCommitPush(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        4,
		Kind:      domain.StageCommitPush,
		Phase:     domain.PhaseBuild,
		Title:     "Commit & Push",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		// Conventional-commit sampling is filled by a follow-up task;
		// default to unknown until the REST commit sample is wired.
		Status:  domain.StatusUnknown,
		Summary: "Conventional-commit sample not yet implemented",
	}
	return st
}

func buildAIReview(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        5,
		Kind:      domain.StageAIReview,
		Phase:     domain.PhaseBuild,
		Title:     "AI Review",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
	}
	if p.LatestOpenPR == nil {
		st.Status = domain.StatusNA
		st.Summary = "No open PRs"
		return st
	}
	st.Status = domain.StatusUnknown
	st.Summary = fmt.Sprintf("PR #%d awaiting review", p.LatestOpenPR.Number)
	st.Details = map[string]any{
		"latestPr": map[string]any{
			"number":   p.LatestOpenPR.Number,
			"url":      p.LatestOpenPR.URL,
			"title":    p.LatestOpenPR.Title,
			"author":   p.LatestOpenPR.Author,
			"openedAt": p.LatestOpenPR.OpenedAt,
		},
	}
	return st
}

func buildRelease(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        7,
		Kind:      domain.StageRelease,
		Phase:     domain.PhaseShip,
		Title:     "Release",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
	}
	if p.LatestRelease == nil {
		st.Status = domain.StatusUnknown
		st.Summary = "No releases published"
		return st
	}
	age := time.Since(p.LatestRelease.PublishedAt)
	st.Status = domain.StatusOK
	st.Summary = fmt.Sprintf("Latest release %s (%s ago)", p.LatestRelease.TagName, humanize(age))
	if age > 30*24*time.Hour {
		st.Status = domain.StatusWarn
	}
	if p.ReleasePleasePR != nil && time.Since(p.ReleasePleasePR.OpenedAt) > 7*24*time.Hour {
		st.Status = domain.StatusWarn
		st.Summary = "release-please PR open > 7 days"
	}
	st.Links = []domain.Link{{Label: "Release", Href: p.LatestRelease.URL}}
	st.Details = map[string]any{
		"latestReleaseTag": p.LatestRelease.TagName,
		"latestReleaseAt":  p.LatestRelease.PublishedAt,
		"latestReleaseUrl": p.LatestRelease.URL,
	}
	if p.ReleasePleasePR != nil {
		st.Details["releasePleasePr"] = map[string]any{
			"number":   p.ReleasePleasePR.Number,
			"url":      p.ReleasePleasePR.URL,
			"title":    p.ReleasePleasePR.Title,
			"openedAt": p.ReleasePleasePR.OpenedAt,
		}
	}
	return st
}

func buildOperate(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        10,
		Kind:      domain.StageOperate,
		Phase:     domain.PhaseRun,
		Title:     "Operate",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		Details: map[string]any{
			"runbookFound": p.HasRunbook,
			"runbookPath":  p.RunbookPath,
			"runbookUrl":   p.RunbookURL,
		},
	}
	if p.HasRunbook {
		st.Status = domain.StatusOK
		st.Summary = "Runbook present"
		st.Links = []domain.Link{{Label: "Runbook", Href: p.RunbookURL}}
	} else {
		st.Status = domain.StatusUnknown
		st.Summary = "No runbook found"
	}
	return st
}

func buildEvolve(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        12,
		Kind:      domain.StageEvolve,
		Phase:     domain.PhaseEvolve,
		Title:     "Evolve",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		Details: map[string]any{
			"migrationIssues":      p.MigrationIssues,
			"breakingChangeIssues": p.BreakingIssues,
		},
	}
	switch {
	case p.MigrationIssues+p.BreakingIssues == 0:
		st.Status = domain.StatusOK
		st.Summary = "No active migrations"
	default:
		st.Status = domain.StatusWarn
		st.Summary = fmt.Sprintf("%d migration / %d breaking-change issues open",
			p.MigrationIssues, p.BreakingIssues)
	}
	return st
}

func buildDecommission(p repoPayload, now string) domain.Stage {
	st := domain.Stage{
		ID:        14,
		Kind:      domain.StageDecommission,
		Phase:     domain.PhaseSunset,
		Title:     "Decommission",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		Details: map[string]any{
			"repoArchived": p.Archived,
		},
	}
	if p.Archived {
		st.Status = domain.StatusOK
		st.Summary = "Repository archived"
	} else {
		st.Status = domain.StatusNA
		st.Summary = ""
	}
	return st
}

// buildCIGates is REST-driven (Checks API). Called by Fetch when the
// default-branch SHA is known.
func buildCIGates(runs []*gh.CheckRun, sha, now string) domain.Stage {
	st := domain.Stage{
		ID:        6,
		Kind:      domain.StageCIGates,
		Phase:     domain.PhaseBuild,
		Title:     "CI Gates",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
	}
	var total, succ, failed, pending int
	var failing []map[string]any
	all := make([]map[string]any, 0, len(runs))
	for _, r := range runs {
		total++
		status := orEmpty(r.Status)
		conclusion := orEmpty(r.Conclusion)
		name := orEmpty(r.Name)
		url := orEmpty(r.HTMLURL)
		row := map[string]any{
			"name":       name,
			"status":     status,
			"conclusion": conclusion,
			"url":        url,
		}
		if r.CompletedAt != nil {
			row["completedAt"] = r.CompletedAt.UTC()
		}
		all = append(all, row)
		switch conclusion {
		case "success":
			succ++
		case "failure", "timed_out", "action_required":
			failed++
			failing = append(failing, row)
		case "":
			pending++
		}
	}
	st.Details = map[string]any{
		"defaultBranchSha": sha,
		"totalChecks":      total,
		"successfulChecks": succ,
		"failedChecks":     failed,
		"pendingChecks":    pending,
		"allChecks":        all,
		"requiredFailing":  failing,
	}
	switch {
	case total == 0:
		st.Status = domain.StatusUnknown
		st.Summary = "No checks run"
	case failed > 0:
		st.Status = domain.StatusFail
		st.Summary = fmt.Sprintf("%d failing of %d", failed, total)
	case pending > 0:
		st.Status = domain.StatusWarn
		st.Summary = fmt.Sprintf("%d pending of %d", pending, total)
	default:
		st.Status = domain.StatusOK
		st.Summary = fmt.Sprintf("%d/%d passed", succ, total)
	}
	return st
}

func orEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func humanize(d time.Duration) string {
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
}
