# Shell completion (openclaw) 🚀

This document explains how the `openclaw completion` command works and how to install, uninstall, and troubleshoot shell completion scripts for supported shells (zsh, bash, Fish, PowerShell).

## Quick commands

- Generate completion script for a shell and print to stdout:
  - `openclaw completion --shell zsh`
- Install completion into your profile:
  - `openclaw completion --shell zsh --install`
- Remove an installed completion block from your profile:
  - `openclaw completion --shell zsh --remove`

---

## Supported shells

- zsh
- bash
- fish
- PowerShell (Windows / pwsh)

### Windows / PowerShell notes
- On Windows, the onboarding wizard defaults to PowerShell for convenience.
- The installer writes a small snippet to the PowerShell profile (`~/Documents/PowerShell/Microsoft.PowerShell_profile.ps1`). If that profile doesn't exist, the installer will create it.

---

## Uninstall / undo

When installing, OpenClaw creates a **backup** of the profile file (appends `.openclaw.bak.<timestamp>`). To remove the completion:

1. Run: `openclaw completion --shell <shell> --remove`
2. The installer will back up the profile before changing it and remove the block that was added.

If something goes wrong, restore the backup file (the `.openclaw.bak.*` file in the same directory).

---

## Troubleshooting

- If completion doesn't appear after install, restart your shell session or source the profile file manually.
  - Example (zsh): `source ~/.zshrc`
  - PowerShell: `. ~\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`
- If profiles differ across machines or shells, ensure you're editing the right profile for your shell.
- If you no longer want the completion, use `--remove` or restore the backup file created in the same directory.

---

If you want additional help, open an issue with the output of `openclaw --version` and your shell name and version.
