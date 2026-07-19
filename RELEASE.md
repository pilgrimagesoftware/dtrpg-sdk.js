# Release Process

Versioning and the changelog are both derived from [Conventional Commits](https://www.conventionalcommits.org/)
history via [git-cliff](https://git-cliff.org), configured in [cliff.toml](cliff.toml).

## Cutting a release

```sh
git checkout develop
git pull
```

Trigger the **Prepare Release** workflow (`workflow_dispatch` in the Actions tab). It:

1. Runs `git-cliff --bump` against `develop` to determine the next version from commits since the last tag.
2. Updates `package.json` to that version via `npm version --no-git-tag-version`.
3. Prepends the generated changelog section to `CHANGELOG.md`.
4. Opens a pull request from an auto-created `release/<version>` branch into `master`.

Review the PR, merge into `master`, then merge the same changes back into `develop`. Tag the release:

```sh
git checkout master
git pull
git tag -a v<version> -m "Release <version>"
git push origin v<version>
```

The tag push triggers the **Release** workflow, which tests, builds, publishes to npm with provenance, and creates
the GitHub Release with the changelog for that tag attached.

## Hotfixes

For an urgent fix to what's currently in production:

```sh
git checkout master
git pull
git checkout -b hotfix/<description>
# fix, bump patch version, commit
```

PR into `master`, merge, tag, which triggers the release workflow. Then PR the same branch into `develop` so the
fix isn't lost on the next regular release.

## npm publishing

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — no `NPM_TOKEN`
secret. The Release workflow has `permissions: id-token: write`, which lets `npm publish` exchange a short-lived
OIDC token for a publish credential at run time, scoped to this exact repository and workflow. `@pilgrimagesoftware/dtrpg-sdk`
must have this workflow (`pilgrimagesoftware/dtrpg-sdk.js`, `.github/workflows/release.yaml`) registered as a
trusted publisher in the package's npm settings before the first publish can succeed. Trusted publishing requires
npm CLI >=11.5.1; the workflow upgrades npm explicitly since the version bundled with Node is typically older.
