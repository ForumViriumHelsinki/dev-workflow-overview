package domain

import "testing"

func TestDeriveOverall(t *testing.T) {
	mkStage := func(kind StageKind, s StatusCode) Stage {
		return Stage{Kind: kind, Status: s, Summary: string(s)}
	}

	cases := []struct {
		name   string
		stages []Stage
		want   StatusCode
	}{
		{
			name: "all-ok",
			stages: []Stage{
				mkStage(StageDeploy, StatusOK),
				mkStage(StageRun, StatusOK),
			},
			want: StatusOK,
		},
		{
			name: "warn-beats-ok",
			stages: []Stage{
				mkStage(StageDeploy, StatusOK),
				mkStage(StageMonitor, StatusWarn),
			},
			want: StatusWarn,
		},
		{
			name: "fail-beats-warn",
			stages: []Stage{
				mkStage(StageDeploy, StatusFail),
				mkStage(StageMonitor, StatusWarn),
			},
			want: StatusFail,
		},
		{
			name: "na-ignored",
			stages: []Stage{
				mkStage(StageDeploy, StatusOK),
				mkStage(StageDeprecate, StatusNA),
			},
			want: StatusOK,
		},
		{
			name: "unknown-above-ok",
			stages: []Stage{
				mkStage(StageDeploy, StatusOK),
				mkStage(StageMonitor, StatusUnknown),
			},
			want: StatusUnknown,
		},
		{
			name:   "all-na-returns-unknown-summary",
			stages: []Stage{mkStage(StageDeprecate, StatusNA)},
			want:   StatusUnknown,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := DeriveOverall(tc.stages)
			if got.Status != tc.want {
				t.Fatalf("DeriveOverall: want %q, got %q", tc.want, got.Status)
			}
		})
	}
}
