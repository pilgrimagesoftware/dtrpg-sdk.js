# Contributing

## Conventional Commits

This project uses the [Conventional Commits standard](https://www.conventionalcommits.org/en/v1.0.0/) for all
commit messages:

```
<type>(<scope>): <description>
```

The changelog and version bump on release are generated directly from commit history via `git-cliff` (see
[RELEASE.md](RELEASE.md)), so a commit that doesn't follow the convention won't be grouped correctly in the
changelog it produces.

## Development

See [docs/typescript.md](https://github.com/pilgrimagesoftware/dtrpg/blob/master/docs/typescript.md) in the
umbrella repo for the full set of TypeScript conventions this project follows.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Run all of the above before opening a pull request; CI runs the same checks, plus `npm audit`.

## Pull requests

- Branch from `develop`, open pull requests against `develop`.
- `master` only receives merges from `release/*` branches (see [RELEASE.md](RELEASE.md)) or `hotfix/*` branches.
- CI must pass before merge.
