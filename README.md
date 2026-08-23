# Exam-Sim (Practice Exam)

A **local macOS** practice-test app. You supply your own question PDFs and matching answer/explanation PDFs. Parsing, timing, review, and notes stay on this computer. Nothing is uploaded to a server.

This project is **not affiliated with, endorsed by, or a reproduction of** the NBME, USMLE, or any other exam board. Do not commit or share copyrighted exam forms, answer keys, or official lab-value sheets.

The GitHub repository is **private**. A link is not enough: GitHub will show 404 until the owner **invites you as a collaborator** (Settings → Collaborators).

---

## What you download

Clone **this repository** (source). There is no prebuilt `.app` in git — you build it on your Mac.

You need:

- A Mac (Apple Silicon is what this project is packed for)
- [Node.js 20 or newer](https://nodejs.org/)
- Xcode Command Line Tools (for the OCR helper)

```bash
xcode-select --install   # if you do not already have them
```

---

## Install and run

```bash
git clone https://github.com/olivyuu/Exam-Sim.git
cd Exam-Sim
npm install
npm test
npm run pack
```

The app is:

```text
release/mac-arm64/Practice Exam.app
```

Open it from Finder. The first time, macOS Gatekeeper may block it (unsigned build):

1. Right-click **Practice Exam.app**
2. Choose **Open**
3. Confirm **Open**

`npm run dist` also writes a `.dmg` in `release/`.

### Develop without packing

```bash
npm run build:ocr
npm run dev
```

---

## Laboratory values PDF (optional)

A lab sheet is **not** required and is **not** in this repo.

### In the app (easiest)

1. Open Practice Exam.
2. On setup, under **Laboratory values PDF (optional)**, click **Choose lab values PDF**.
3. Pick a PDF you are allowed to use.
4. The header **Lab Values** button works during the test. Click **Remove lab PDF** to clear it.

If you skip this, the test still runs. Lab Values stays off.

### Before you pack (optional, bundled into the .app)

If you want Lab Values available without picking a file each time:

```bash
cp /path/to/your-lab-values.pdf resources/lab-reference.pdf
npm run pack
```

Use only a sheet you have the right to use. Do not commit that file to GitHub.

---

## Using the app

1. Optionally add a lab-values PDF (see above).
2. **Add Question PDF** — one or more question booklets.
3. **Add Answer PDF** — matching explanation files. Names like `3 Q.pdf` and `3A.pdf` pair automatically when possible.
4. Fix bad pairs with **Replace question**, **Replace answer**, or **Unmatch**.
5. Every question file needs an answer file, then start the timed test.
6. Check the import preview. If formatted text could not be generated reliably, that item shows the **original PDF page** with a short note.

During the test:

| Control | What it does |
| --- | --- |
| Timer | 1.5 minutes per extracted question |
| Mark | Flag the item |
| Lab Values | Opens your lab PDF if you added one |
| Notes | Per-question notes (saved until you reset) |
| Highlight | Drag across the stem |
| Strike | Right-click (Control-click) a choice |
| Review Questions | Jump around the block (clock still runs) |

Keyboard: Left/Right = previous/next, **F** = flag, **L** = lab sheet, **⌘F** = search in the lab sheet (not while typing in Notes).

After **End Exam**, you can review keyed answers and explanations. If any items have notes, you can export an `.xlsx` (question number, notes, stem, choices). Resetting the test clears answers, flags, highlights, strikes, notes, and results.

**You are responsible for the PDFs you load.** Only use materials you have the right to use.

---

## Project layout

```text
src/parser/          PDF text → questions, choices, keys
src/renderer/        Exam UI (Electron + React)
src/main/            File access, OCR helper, session
resources/           OCR helper source (Swift); optional lab PDF (not in git)
scripts/             Local parser QC helpers (optional)
```

---

## Troubleshooting

| Problem | What to try |
| --- | --- |
| `npm run pack` fails on OCR | `xcode-select --install`, then `npm run build:ocr` |
| App will not open | Right-click → Open. Unsigned personal builds are expected. |
| `git clone` 404 | Ask the owner to invite your GitHub account as a collaborator. |
| Scanned PDFs look empty | First import can take a while; those pages are OCR’d. |
| Formatted stem looks wrong | Use **Show image of original question**, or re-import after a rebuild. |
| Intel Mac | `npm run pack` on that machine so Electron builds for your CPU. |
| Lab Values is disabled | Add a lab PDF on setup, or copy one to `resources/lab-reference.pdf` and pack again. |

---

## License

MIT — see [LICENSE](LICENSE). This license covers **the software**, not any exam or lab PDFs users add on their own computers.
