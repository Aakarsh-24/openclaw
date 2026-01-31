---
name: Git Commit Formatter
description: Formats git commit messages according to Conventional Commits.
---

# Git Commit Formatter

This skill helps you formatted git commit messages specifically adhering to the Conventional Commits specification.

## Usage

When you need to commit changes, use this skill to ensure the message follows the format:
`<type>[optional scope]: <description>`

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

## Instructions

1. Identify the primary change type.
2. Determine the scope (optional, but recommended for monorepos).
3. Write a concise description (imperative mood, no period at end).
4. If there is a breaking change, include `BREAKING CHANGE:` in the footer.
