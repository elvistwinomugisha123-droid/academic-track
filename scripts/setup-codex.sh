#!/usr/bin/env bash
set -euo pipefail

echo "ATE v4 Codex setup"
echo "Repository: $(pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required." >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required." >&2
  exit 1
fi

echo
echo "1/6 Installing Impeccable for project-local Codex..."
npx impeccable install --providers=codex --scope=project

echo
echo "2/6 Installing Emil Kowalski design-engineering skill..."
npx skills@latest add emilkowalski/skills --skill emil-design-eng

echo
echo "3/6 Installing Taste Codex/GPT skill..."
npx skills@latest add https://github.com/Leonxlnx/taste-skill --skill gpt-taste

echo
echo "4/6 Installing React best-practices skill..."
npx skills@latest add vercel-labs/agent-skills --skill vercel-react-best-practices

echo
echo "5/6 Installing web-design-guidelines skill..."
npx skills@latest add vercel-labs/agent-skills --skill web-design-guidelines

echo
echo "6/6 Installing ATE-owned testing/UI verification skills..."
mkdir -p .agents/skills/ate-test-engineering
mkdir -p .agents/skills/ate-ui-verification
cp codex-skills/ate-test-engineering/SKILL.md .agents/skills/ate-test-engineering/SKILL.md
cp codex-skills/ate-ui-verification/SKILL.md .agents/skills/ate-ui-verification/SKILL.md

echo
echo "Codex skill setup complete."
echo
echo "Installed/expected skills:"
echo "  - impeccable"
echo "  - emil-design-eng"
echo "  - gpt-taste"
echo "  - react-best-practices"
echo "  - web-design-guidelines"
echo "  - ate-test-engineering"
echo "  - ate-ui-verification"
echo
echo "Next:"
echo "  1. Open Codex in this repository."
echo "  2. If Codex asks, approve the Impeccable project hook via /hooks."
echo "  3. Ask Codex to read AGENTS.md, PRD.md, TRD.md, DESIGN.md and CODEX_SETUP.md."
echo "  4. Run the baseline-audit prompt from CODEX_SETUP.md before feature migration."
