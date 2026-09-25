# FocusPlan

A focus planner for intense, short-term goals: exam weeks, project sprints, learning a skill before a deadline.

FocusPlan lays out your day as focus blocks, short breaks, long breaks, meals, and wind-down. It shows what you should be doing **right now**, and gives you a checklist for every block. Describe a new goal and an AI model turns it into a full day-by-day plan.

<!-- Screenshot: add docs/screenshot.png and uncomment -->
<!-- ![FocusPlan](docs/screenshot.png) -->

## Features

- **Animated walkthrough**: an SVG + GSAP demo of how FocusPlan works. It plays every time the app starts, using the same ✨ Personalize tab as the real interface. When it closes, the real tab is highlighted so you know where to start. Replay it any time with **▶ How it works**.
- **Right Now panel**: a live clock plus a big color-coded status (focus / break / meal / sleep) and the tasks for the current block.
- **Checklist**: every day, every block, every break, in order. Past blocks fade out, the current block is highlighted, and finished blocks get a DONE badge.
- **Daily timeline**: the whole day on one line, with the current moment moved to the top.
- **Up to 5 plans** side by side. Switch with one click; each plan keeps its own progress.
- **✨ Personalize (AI plan generator)**: pick a provider and model, paste your API key, describe the goal, choose the dates and your wake/sleep times. You get a preview before you save.
- **🔌 Test connection**: right under the provider and model, it sends just "hi" to confirm your key and the AI are connected before you generate.
- Plans created with AI show your goal (🎯) under the plan name, so the checklist always says what it's for.
- Follows the real calendar: the app always opens on today.
- No accounts, no server, no build step. Everything is stored in your browser.

## AI providers and models

Only recent, low-cost models are offered. There are no "pro" or premium tiers, and the cheapest model is always listed first and preselected.

| Provider | Key (environment variable name) | Models offered (cheapest first) |
|---|---|---|
| **DeepSeek** (default) | `DEEPSEEK_API_KEY` | `deepseek-flash` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` (all have a free tier) |
| OpenAI (ChatGPT) | `OPENAI_API_KEY` | `gpt-6-luna`, `gpt-5.6-luna`, `gpt-5.4-nano`, `gpt-5.4-mini`, `gpt-6-sol` |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | `claude-haiku-4-5`, `claude-sonnet-5` |
| OpenRouter | `OPENROUTER_API_KEY` | Live list: the 30 cheapest recent chat models, **free ones first**, with prices |

Prices were checked on 2026-09-25 against each provider's official pricing page. They're kept in `js/providers.js` (`PRICES`). **Load models** narrows each list to the models your key can actually use.

The environment variable name is shown as a reference. FocusPlan runs in the browser, so you paste the key into the app; it can't read environment variables.

The AI never sets the times. FocusPlan builds the schedule itself (focus blocks, breaks, lunch around 12:30, dinner around 17:30, wind-down) and asks the model only to fill each block with short, concrete tasks. The reply is validated and repaired, so every block of every day ends up assigned.

## Run it

It's a static site. Serve the folder with any web server (ES modules don't load from `file://`):

```bash
cd FocusPlan
python -m http.server 8766
```

Then open http://localhost:8766.

## Create a plan

1. Open **✨ Personalize** (the first tab).
2. Pick a provider (DeepSeek is the default), paste your API key, and click **🔌 Test connection** to confirm it works.
3. Describe what you want to accomplish, and choose the start/end dates (up to 31 days), wake/sleep times, and block length.
4. Click **Generate plan**, check the preview, then **Save as plan**.

## Privacy

- Your API key stays in your browser. It is sent only to the provider you choose, and saved only if you tick **Remember on this device**. **Forget** removes it.
- Plans and progress live in `localStorage`, so clearing site data erases them.
- Calls go directly from the browser to the provider. Only use your own key, on your own device.

## Project layout

```
index.html          page shell
css/styles.css      styles (dark theme, mobile-friendly)
js/app.js           rendering: plan switcher, checklist, timeline, Right Now, Personalize
js/demo.js          SVG + GSAP "How it works" animation
js/schedule.js      builds each day's focus/break/meal schedule
js/storage.js       plans, per-plan progress, keys (localStorage)
js/generator.js     prompt, JSON schema, validation and repair of AI output
js/providers.js     DeepSeek / Gemini / OpenAI / Anthropic / OpenRouter adapters and price table
js/plans/b471.js    example plan (a 7-day university exam countdown)
```

## Hosting

The app is fully static, so it can be served with GitHub Pages (Settings → Pages → deploy from `main`).

## License

MIT
