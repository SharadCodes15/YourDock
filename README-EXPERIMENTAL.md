# Experimental / Developer Options

This feature flag system lets you enable, disable, or tweak in-progress or higher-risk
features of the macOS-style Menu Bar & Dock app without needing to edit code.

## Flags

| Flag                  | Default | Description                                       |
|-----------------------|---------|---------------------------------------------------|
| `directionalReveal`   | true    | Smart dock reveal using cursor heading detection  |
| `autoArrangeByUsage`  | false   | Auto-sort running apps by launch frequency        |
| `weatherWidget`       | true    | Enable the weather widget in Notification Center  |

## How to edit

You can toggle flags from Settings → Experimental (unlocked by clicking the version
number in About 7 times), or by editing `experimental-flags.json` directly in the
app's userData folder with any text editor.

## Caution

Some flags control experimental features that may impact stability or performance.
If something misbehaves, disable the flag and restart.
