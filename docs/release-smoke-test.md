# Release smoke-test checklist

Use this checklist against a release candidate built from a clean checkout. Record
the operating system, desktop environment, package version, upgrade source
version, and result for every platform tested.

## Artifact inventory

- [ ] The release contains exactly one Linux AppImage, one DEB, one RPM, one
  Windows installer EXE, and one Windows portable ZIP for each supported
  architecture.
- [ ] Linux artifacts are named
  `Zap-Browser-<version>-linux-<arch>.<extension>`.
- [ ] The Windows installer is named
  `Zap-Browser-Setup-<version>-<arch>.exe`.
- [ ] The Windows portable archive is named
  `Zap-Browser-Portable-<version>-<arch>.zip`.
- [ ] There is no portable EXE, `win-x64.exe`, duplicate Windows build, or other
  ambiguously named release artifact.

## Linux AppImage

- [ ] Mark the AppImage executable and launch it from a terminal.
- [ ] Confirm the main window opens without a missing-library or sandbox error.
- [ ] Confirm the application icon appears in the window switcher and taskbar.
- [ ] Open a URL passed on the command line and confirm it loads.

## Debian package

- [ ] Install the previous release with `sudo apt install ./<previous>.deb`.
- [ ] Upgrade in place with `sudo apt install ./<candidate>.deb`.
- [ ] Confirm `/opt/Zap-Browser/zap-browser` exists and launches.
- [ ] Confirm `/opt/Zap Browser` is absent after upgrading from a legacy package.
- [ ] Confirm existing user data, profiles, and bookmarks remain available.
- [ ] Launch from the desktop menu and from `zap-browser`.
- [ ] Inspect `/usr/share/applications/zap-browser.desktop` and confirm:
  - [ ] `Name=Zap Browser`
  - [ ] `Exec=/opt/Zap-Browser/zap-browser %U`
  - [ ] `Icon=zap-browser`
  - [ ] `StartupWMClass=zap-browser`
- [ ] Confirm the current icon is displayed after install and upgrade, with no
  stale or duplicate desktop-menu entry.
- [ ] Remove the package and confirm application files and menu metadata are
  removed without deleting user data.

## RPM package

- [ ] Install the previous release with `sudo rpm -ivh <previous>.rpm`.
- [ ] Upgrade in place with `sudo rpm -Uvh <candidate>.rpm`.
- [ ] Confirm `/opt/Zap-Browser/zap-browser` exists and launches.
- [ ] Confirm `/opt/Zap Browser` is absent after upgrading from a legacy package.
- [ ] Confirm existing user data, profiles, and bookmarks remain available.
- [ ] Launch from the desktop menu and from `zap-browser`.
- [ ] Inspect `/usr/share/applications/zap-browser.desktop` and confirm:
  - [ ] `Name=Zap Browser`
  - [ ] `Exec=/opt/Zap-Browser/zap-browser %U`
  - [ ] `Icon=zap-browser`
  - [ ] `StartupWMClass=zap-browser`
- [ ] Confirm `update-desktop-database` and `gtk-update-icon-cache` complete when
  available, and the current icon appears after an upgrade.
- [ ] Confirm there is no stale or duplicate desktop-menu entry.
- [ ] Remove the package and confirm application files and menu metadata are
  removed without deleting user data.

## Linux window-class validation

- [ ] Launch Zap Browser from the installed desktop entry.
- [ ] Run `xprop WM_CLASS`, click the Zap Browser window, and confirm the reported
  class matches `zap-browser`.
- [ ] Confirm the running window groups under the Zap Browser launcher instead
  of creating a second generic Electron icon.

## Windows installer

- [ ] Run `Zap-Browser-Setup-<version>-x64.exe`.
- [ ] Complete a fresh install and launch from the Start menu and desktop
  shortcut.
- [ ] Install the candidate over the previous release and confirm settings and
  user data remain available.
- [ ] Confirm Add/Remove Programs shows one Zap Browser installation.
- [ ] Uninstall and confirm the installed application is removed without an
  unexpected portable EXE being left behind.

## Windows portable ZIP

- [ ] Extract `Zap-Browser-Portable-<version>-x64.zip` to a new directory.
- [ ] Launch `zap-browser.exe` directly without running an installer.
- [ ] Confirm the archive does not contain another installer or ambiguously
  named portable EXE.
- [ ] Confirm portable-mode data behavior is correct when the `.portable` marker
  is used.

## Cross-platform application regression

Run these checks on at least one installed Linux package and one Windows build:

- [ ] Upgrade from a release containing legacy bookmarks and confirm bookmark
  migration preserves folders and entries.
- [ ] Confirm profile data migrates and the active profile remains usable.
- [ ] Enable and disable the Tor toggle with a local Tor proxy available; confirm
  normal browsing still works after disabling it.
- [ ] Open and close private tabs; confirm they are isolated and do not restore
  as normal tabs.
- [ ] Exercise Nostr permission allow/deny flows and confirm saved permissions
  remain scoped correctly.
- [ ] Download a file and confirm progress, completion, and opening the download
  location.
- [ ] Use `Ctrl+F`, find text, move between matches, and close the find bar.
- [ ] Drag bookmarks within the bookmark bar and into/out of folders; restart and
  confirm the order persists.
- [ ] Switch profiles and confirm tabs, site data, bookmarks, permissions, and
  identities follow the expected profile boundaries.

## Release sign-off

- [ ] Automated tests and renderer production build pass.
- [ ] DEB and RPM package contents were inspected before publishing.
- [ ] Fresh-install and upgrade paths were tested with the actual release
  artifacts.
- [ ] Any failed or skipped check is documented in the release notes with an
  owner and follow-up issue.
