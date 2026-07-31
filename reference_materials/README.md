# reference_materials/

The Can't Stop rulebook lives here **locally only** — it is copyrighted, so it is gitignored
(`reference_materials/*.pdf`) and never committed. The engine cites page numbers in comments instead of
reproducing text, which is how a rule citation survives without shipping the PDF.

## What you need

```
reference_materials/CantStopRules.pdf
```

## How to get it

Copy it out of the Game Hub platform repo, which keeps the reference PDFs (also gitignored) under its own
`reference_materials/`:

```bash
cp /path/to/container/reference_materials/CantStopRules.pdf reference_materials/
```

`CantStopRules.pdf` is the authoritative source for every rule in this package. **Read the relevant page
before implementing or changing a rule, and cite it in a comment** (`// pg. N: …`) — never from memory.
