# FocusPlan

**Turn any goal into a day-by-day focus plan, and always know what to do right now.**

![How FocusPlan works: describe your goal, AI builds the plan, your day block by block, check it off, switch plans and see your progress](docs/how-it-works.svg)

*How it works, in 5 steps (the same walkthrough plays when the app opens): **1** describe your goal → **2** the AI builds your plan → **3** your day, block by block → **4** check it off → **5** switch plans and see what you've accomplished.*

## Start

Nothing to install except [Python](https://www.python.org/downloads/), which serves the page on your computer. Get the code by cloning the repo, or with **Code → Download ZIP** on this page (then unzip it). Start it from inside the folder:

```bash
git clone https://github.com/Japulgarin/FocusPlan.git
cd FocusPlan
python -m http.server 8766
```

Open **http://localhost:8766**. Downloaded the ZIP on Windows? Just double-click `start.bat` in the folder.

## How to use

1. **✨ Personalize:** pick an AI (DeepSeek is the default and cheapest), paste your API key and press **🔌 Test**.
2. **Describe your goal**, or tap an example (📗 Study, 📘 Exam, 💼 Work…), then pick your dates and wake/sleep times.
3. **✨ Generate plan:** watch it being written day by day, check the preview, then **Save**.
4. **Follow it:** the **Right Now** panel shows what to do this minute. Tick tasks as you go and see your progress.

No API key? Load a ready-made plan from the **"+ example"** pills at the top.

## Features

- **Right Now panel:** what to do this minute: focus, break, meal or sleep.
- **Checklist and timeline** for every day, with breaks and meals already scheduled.
- **AI plans in seconds** from 5 providers, cheapest models first, with live progress while they're written.
- **Up to 10 plans**, each with its own dates, icon and progress.
- **Example prompts and ready-made example plans** (📗 study week, 📘 exam).
- **Private:** no accounts, no server. Everything stays in your browser.

## AI providers and models

Only recent, low-cost models, cheapest first.

| Provider | Key (environment variable name) | Models offered (cheapest first) |
|---|---|---|
| **DeepSeek** (default) | `DEEPSEEK_API_KEY` | `deepseek-flash` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` (all have a free tier) |
| OpenAI (ChatGPT) | `OPENAI_API_KEY` | `gpt-6-luna`, `gpt-5.6-luna`, `gpt-5.4-nano`, `gpt-5.4-mini`, `gpt-6-sol` |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | `claude-haiku-4-5`, `claude-sonnet-5` |
| OpenRouter | `OPENROUTER_API_KEY` | Live list: the 30 cheapest recent chat models, **free ones first**, with prices |

Prices were checked on 2026-09-25 and live in `js/providers.js`. You paste the key into the app; the variable name is only a reference.

## Privacy

- Keys are saved only when you press **Save**, only in your browser, and are sent only to their own provider.
- Plans and progress live in your browser, so clearing site data erases them.

## Project layout

```
start.bat             double-click to run the app locally (Windows)
publish.bat           double-click to publish to GitHub, with an API-key check
index.html            page shell
css/styles.css        styles (dark theme, mobile-friendly)
docs/how-it-works.svg animated walkthrough shown at the top of this README
js/app.js             rendering: plan switcher, checklist, timeline, Right Now, Personalize
js/demo.js            SVG + GSAP "How it works" animation inside the app
js/schedule.js        builds each day's focus/break/meal schedule; date helpers
js/storage.js         plans, per-plan progress, keys (localStorage)
js/generator.js       prompt, JSON schema, validation and repair of AI output
js/providers.js       DeepSeek / Gemini / OpenAI / Anthropic / OpenRouter adapters and price table
js/plans/b471.js      built-in plan (a 7-day university exam countdown)
js/plans/study.js     example plan: normal study week (AI-generated)
js/plans/micro.js     example plan: Microeconomics exam (AI-generated)
js/plans/examples.js  example list, prompt chips, and loading an example from today
```

## Roadmap

- **Local AI models:** generate plans with **LM Studio** and **llama.cpp** running on your own computer. Both offer an OpenAI-compatible server, so there's no API key and no cost, and nothing leaves your machine.
- **Edit plans you already have:** change the time of a slot, move or resize a focus block, rename a session, and add, remove or reorder tasks.
- **Per-day schedules:** a different wake/sleep time or block length for a single day, or a rest day in the middle of a plan.
- **Carry over unfinished tasks** to the next day with one click.
- **Reminders** when a focus block, break or meal starts.
- **Export and import:** plans as a file to back up or share, and as a calendar (`.ics`).
- **Hosted version** on GitHub Pages, so it runs without downloading anything.

## Publishing changes

Double-click **`publish.bat`**: it stages everything, **refuses to publish if any file looks like it contains an API key** (it lists the files, never the key), asks for a commit message and pushes to GitHub.

## Hosting

The app is fully static, so it can be served with GitHub Pages (Settings → Pages → deploy from `main`).

## License

MIT
