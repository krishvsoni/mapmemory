# mapmemory

**Long-term memory for AI agents.**

AI assistants forget. Every conversation starts from zero, and anything a customer
told your agent last week is gone. mapmemory gives your agents a memory that lasts:
it remembers people, preferences, decisions and events, keeps that knowledge
accurate as things change, and hands the right context back at the moment it is needed.

## What it does

- **Remembers what matters.** Feed it conversations, notes or meeting transcripts.
  It picks out the people, places, organizations and facts that matter and ties
  them together into a connected picture rather than a pile of text.
- **Stays up to date.** When a fact changes ("Priya moved from Berlin to Austin"),
  mapmemory retires the old fact and keeps the new one. The history is preserved,
  so you can still see what used to be true and when it changed.
- **Answers across time.** Ask what was true today, or as of any past date.
- **Learns over time.** It periodically steps back, spots patterns across many
  interactions and records higher-level insights, the way a person forms an
  impression of a customer after many conversations.
- **Finds the right context fast.** A question like "What does this client care
  about?" returns the most relevant facts and past moments, ranked, with a
  trace of where each came from.
- **Keeps every customer separate.** Each organization gets its own private
  memory, and teams can be split into separate memory spaces.

## Who it is for

| Team | Use |
| --- | --- |
| Product teams building AI assistants | Give your assistant continuity across sessions and users |
| Customer success and sales | Keep a living record of each account's needs, history and commitments |
| Internal knowledge and meeting tools | Turn meetings and chats into searchable, connected knowledge |
| Agencies and platforms | Offer memory as a service to many clients, each fully isolated |

## Highlights

**Built for teams**
- Sign in with your company's single sign-on, or use developer keys for automation.
- Roles for admins, contributors and read-only users.
- Keys can be limited to a single memory space.
- A complete activity log of who did what and when.

**Built for business**
- Free, Pro and Enterprise plans with clear usage limits.
- Self-service subscription and billing management.
- Usage dashboard showing consumption against your plan.

**Built to be dependable**
- Fair sharing, so one busy customer never slows down another.
- Safe retries: sending the same message twice never creates duplicates.
- Protection against runaway usage and provider outages.

## Dashboard

A web dashboard is included for day-to-day use:

- Create your workspace and memory spaces
- Add information and ask questions in a built-in console
- Explore the knowledge graph for any space
- Manage access keys and team members
- Track usage and plan limits

## Works with the AI tools you already use

- Choose your AI provider: **OpenAI** directly, or **OpenRouter** for access to many models.
- Connect to assistants such as Claude through the built-in MCP connection.
- Includes an evaluation toolkit to measure how well memory improves answers.

## Getting started

1. Create a workspace and receive your access key.
2. Create a memory space for a project, customer or team.
3. Send in information as it happens.
4. Ask questions whenever your agent needs context.

For installation, configuration and the technical design, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
