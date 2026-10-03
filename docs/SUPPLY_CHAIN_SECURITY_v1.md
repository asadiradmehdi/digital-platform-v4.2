# Supply Chain Security v1

## Release requirements
- Use the repository-pinned pnpm and Node ranges.
- Commit and review lockfiles for root and mobile workspaces.
- Run dependency vulnerability/SCA checks in CI.
- Review transitive dependencies for packages with access to credentials, network, filesystem or native code.
- Prefer minimal dependencies and official platform modules.
- Generate SBOM for release artifacts.
- Record package manager, Node, Expo/React Native and build tool versions.
- Reject unexpected dependency additions without a reviewed task/ADR.
- Scan source and artifacts for secrets before release.
- Hash/sign release artifacts in the deployment pipeline.
- Keep build credentials outside repository and client bundles.
- Mobile native builds must be reproducible enough to detect unexpected dependency or resource changes.

## Mobile-specific rule
OWASP notes that malicious code can enter through compromised dependencies, SDKs or build tooling; therefore the mobile release process must inspect the software supply chain, not just application source code. citeturn0search12
