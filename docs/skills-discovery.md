# Skill discovery and installation

`openyida agent-capabilities --summary-json` separates runtime reading from installation:

- `skills.selected` is the first candidate with an existing, readable regular `SKILL.md`. A read-only directory is valid. It is `null` when no readable entry exists.
- `skills.install_target` is the first writable host/workspace destination. It may not exist yet and does not imply runtime readiness.
- `usable` and `readable` describe reading the root entry; `installable` describes an installation destination. Child documents are checked when loaded.
- Host candidates keep their existing priority. If none are readable, the current CLI package's bundled `yida-skills` is the final read fallback and is never an installation target.

Discovery is read-only. It does not copy skills, change permissions or register skills with the host. Agents may read the selected root and its relative references when supported; host-native skill registration remains a separate concern. A host denying access must be respected.

`openyida copy` uses `install_target`, independently of the runtime selection.
