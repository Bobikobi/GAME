/** A release promotes this repository's develop branch into main. GitHub repository names are case-insensitive. */
export function isReleasePullRequest(
  baseRef: string | undefined,
  headRef: string | undefined,
  headRepository: string | undefined,
  repository: string | undefined,
): boolean {
  return baseRef === 'main' && headRef === 'develop' && Boolean(repository)
    && headRepository?.toLowerCase() === repository?.toLowerCase();
}
