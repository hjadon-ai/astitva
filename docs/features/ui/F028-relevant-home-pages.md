# F028: Relevant home pages

- **Status:** Approved
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Make the public home page explain what Astitva currently does, and make the signed-in home page a useful starting point for daily work. Remove sample projects, invented stats, and placeholder copy.

## User flow

1. A visitor opens the public home page and understands the available Priorities, Diet, Finance, and Family features before signing up or logging in.
2. After login, the member sees a short overview and direct links to the parts of the workspace they can use.
3. The member chooses a destination and returns to Home to choose another task.

## In scope

- Public page: accurate feature descriptions, clear login/signup entry, and a short privacy explanation that matches F018 sharing rules.
- Signed-in page: greeting, direct links to Priorities, Diet, Finance, and Family, plus account/session information already available to the client.
- Show only real data if a live summary is added. Use an honest empty or unavailable state instead of sample counts.
- Responsive layouts and keyboard-accessible links using the existing visual system.
- Preserve the existing web and server version display.

## Out of scope

- New feature behavior, new tracking metrics, public project portfolio, Notes, recommendations, and a separate dashboard service.
- Changes to Family sharing permissions, Finance availability, or authentication.

## Wireframe or UI changes

- **Public:** Hero with login/signup panel; below it, four compact feature cards and a privacy section. Replace “Projects will live here” and biography placeholders.
- **Signed in:** Greeting and account status followed by four destination cards. Replace “2 projects,” “25% profile,” and the sample workspace card. Finance should indicate when it is unavailable in the current environment.
- On a narrow screen, cards stack in reading order without hiding the primary action.

## API changes

None required for the initial version. Any later live summary would need a separate reviewed API design.

## MongoDB changes

None.

## Architecture decisions

- Use existing routes and runtime metadata; do not invent personalized numbers.
- Keep Home as a navigation and orientation page, with full feature detail in each tab.
- Use F018's explicit opt-in rule when describing Family data sharing.

## Acceptance criteria

- A visitor can identify the four current feature areas and reach login or signup.
- A signed-in member can open each feature from Home with keyboard or pointer.
- Neither home page displays sample projects, invented profile completion, or placeholder copy.
- Finance messaging remains accurate when the feature is disabled.
- Existing auth, version display, and mobile navigation still work.

## Local verification

Build the web app, then inspect public and signed-in Home in local Dev and Stage at desktop and mobile widths. Check navigation, keyboard focus, Finance-disabled state, and version display.

## Owner decisions

### 1. Should the signed-in Home remain a set of shortcuts, or show small live summaries for Priorities, Diet, Finance, and Family in a later step?

> Going forward will use signed-in Home page as a very basic social media home page.

### 2. Should the public page explain that signup may require an invitation in Production, and where should that message appear?

> Yes, this is going to be family social application for better management

## Approval comment

> Treat Astitva as Social site for family members and will expand gradually.
