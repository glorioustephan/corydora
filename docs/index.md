---
layout: home
hero:
  name: Corydora
  text: Overnight AI Maintenance for Your Repository
  tagline: Run focused cleanup, refactoring, linting, or documentation passes on changes you can review in the morning.
  image:
    src: /logo.png
    alt: Corydora
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: View on GitHub
      link: https://github.com/glorioustephan/corydora

features:
  - title: Choose a focus
    details: Run `auto` for general maintenance or switch to `churn`, `clean`, `refactor`, `performance`, `linting`, or `documentation` when you want Corydora to concentrate on one kind of improvement.
  - title: Bring your provider
    details: Use the runtime you already trust. Corydora supports Claude, OpenAI, Gemini, Bedrock, and Ollama through CLI-backed and API-backed routes.
  - title: Reviewable changes
    details: Corydora applies focused fixes in an isolated git context, commits them incrementally, and reports the effective isolation mode that was used for the run.
  - title: Background-friendly
    details: Start a tmux-backed run, check progress with `corydora status`, reattach with `corydora attach`, and resume an interrupted run with `corydora run --resume`.
  - title: Cost-aware execution
    details: Large files can be analyzed in smaller windows, stage routes can use different models, and fix handoffs stay concise so runs can stay productive without wasting tokens.
  - title: Configurable by project
    details: Set a default mode, choose the agents you want active, tune retries and worker counts, and route analysis and fixes differently when your workflow needs it.
---
