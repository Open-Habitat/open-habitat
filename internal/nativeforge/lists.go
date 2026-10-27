package nativeforge

// Incomplete is why a repository list ended before the provider said it was
// done. A list that is not complete is never presented as the whole list.
type Incomplete string

const (
	// IncompleteLimit: a time-independent bound (pages, results, bytes) was
	// reached and more repositories may exist.
	IncompleteLimit Incomplete = "limit"
	// IncompleteInterrupted: a later page failed or the time bound ran out.
	IncompleteInterrupted Incomplete = "interrupted"
	// IncompleteInconsistent: the pages disagreed with each other (a
	// repeated repository, a changed total, a pagination link outside the
	// list, a repository described inconsistently), so some may be missing.
	IncompleteInconsistent Incomplete = "inconsistent"
)
