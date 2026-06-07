# Architektura trAInR

Ten dokument opisuje, jak zbudowana jest aplikacja trAInR: warstwy, przepływ requestów, API, auth i deployment. Jest punktem odniesienia dla osób znających klasyczny układ **Angular SPA + NestJS API** — poniżej jest też krótkie porównanie.

## TL;DR

trAInR to **monolit SSR** hostowany na **Vercel**:

- jeden repo, jeden deploy — strony HTML i endpointy API żyją w tym samym projekcie Astro;
- renderowanie po stronie serwera (`output: "server"`);
- interaktywność przez małe **React islands** (hydratacja tylko tam, gdzie trzeba);
- logika biznesowa w `src/lib/`, dane i auth w **Supabase** (zewnętrzny SaaS);
- po buildzie każda strona i każdy endpoint API staje się **serverless function** na Vercel.

To **nie** jest SPA w stylu Angulara (pusty `index.html` + routing w przeglądarce).

---

## Stack i konfiguracja

| Element         | Technologia                | Rola                                       |
| --------------- | -------------------------- | ------------------------------------------ |
| Framework       | Astro 6                    | Routing, SSR, API routes                   |
| UI interaktywne | React 19                   | Formularze, filtry, modale (`client:load`) |
| Styling         | Tailwind CSS 4             | Utility-first CSS                          |
| Baza + auth     | Supabase                   | PostgreSQL, RLS, sesje cookie              |
| Hosting         | Vercel (`@astrojs/vercel`) | Serverless deployment                      |
| CI              | GitHub Actions             | lint, test, build, deploy                  |

Kluczowa konfiguracja w `astro.config.mjs`:

```js
output: "server",      // pełny SSR — render przy każdym requestcie
adapter: vercel(),     // build → serverless functions na Vercel
```

Sekrety (`SUPABASE_URL`, `SUPABASE_KEY`) są zadeklarowane w `env.schema` jako **server-only** — nie trafiają do bundla klienta.

---

## Warstwy — co gdzie żyje

```
Przeglądarka
    │
    ▼
Vercel (serverless)
    │
    ├── middleware.ts          ← auth, role, redirecty (każdy request)
    │
    ├── src/pages/**/*.astro   ← strony SSR (HTML z serwera)
    │       └── React islands  ← client:load — hydratacja w przeglądarce
    │
    ├── src/pages/api/**/*.ts  ← endpointy HTTP (GET/POST/…)
    │
    └── src/lib/               ← serwisy, schematy Zod, guards
            │
            ▼
        Supabase (DB + Auth)
```

| Warstwa          | Ścieżka                | Odpowiedzialność                                                    |
| ---------------- | ---------------------- | ------------------------------------------------------------------- |
| Routing stron    | `src/pages/`           | Plik = URL (`trainer/exercises/index.astro` → `/trainer/exercises`) |
| Middleware       | `src/middleware.ts`    | Sesja użytkownika, role (`trainer` / `client`), ochrona tras        |
| API              | `src/pages/api/`       | REST-like endpointy; `export const GET/POST: APIRoute`              |
| Logika biznesowa | `src/lib/`             | Serwisy, walidacja (Zod), guards API, helpery Supabase              |
| Komponenty       | `src/components/`      | Astro (statyczne) + React (interaktywne)                            |
| Layouty          | `src/layouts/`         | Wspólny szablon HTML                                                |
| Typy             | `src/types.ts`         | Współdzielone typy/DTO                                              |
| Migracje DB      | `supabase/migrations/` | Schema PostgreSQL + RLS                                             |

---

## Przepływ requestów

### 1. Strona tylko do odczytu (SSR)

Przykład: `/trainer/exercises`

1. Request trafia na Vercel.
2. `middleware.ts` odczytuje sesję Supabase z cookies, ustawia `context.locals.user` i `role`, ewentualnie robi redirect.
3. Frontmatter pliku `.astro` (kod między `---`) wykonuje się **na serwerze** — np. `listExercises()`, query do Supabase.
4. Astro generuje gotowy HTML z danymi.
5. Do przeglądarki idzie HTML + JS tylko dla React islands (np. `ExerciseFilters client:load`).

**Dane listy nie muszą iść przez `/api/*`** — pobierane są bezpośrednio w SSR, co skraca round-trip.

### 2. Mutacja danych (React island → API route)

Przykład: tworzenie ćwiczenia w `ExerciseForm.tsx`

1. Użytkownik wypełnia formularz (React w przeglądarce).
2. `fetch("/api/exercises", { method: "POST", ... })` — request do tego samego hosta.
3. Middleware → handler `src/pages/api/exercises/index.ts`.
4. Guard (`requireTrainer`), walidacja Zod, serwis `createExercise()` → Supabase.
5. Odpowiedź JSON lub redirect.

Flow: **Browser → Vercel → middleware → API route → lib/ → Supabase → JSON**.

### 3. Auth (form POST + redirect)

Przykład: `/api/auth/signin`

- Klasyczny POST formularza (`formData`), nie JSON API.
- Supabase `signInWithPassword`, cookies ustawiane przez `@supabase/ssr`.
- Redirect na dashboard w zależności od roli.

---

## API w Astro vs NestJS

W NestJS API to osobna aplikacja (`@Controller`, moduły, DI). W Astro endpointy to **pliki** w `src/pages/api/`:

```ts
export const prerender = false;  // wymagane — endpoint musi być dynamiczny

export const GET: APIRoute = async (context) => { ... };
export const POST: APIRoute = async (context) => { ... };
```

Konwencje w tym projekcie:

- `prerender = false` na każdym API route (reguła w `AGENTS.md`).
- Walidacja wejścia przez **Zod** w `src/lib/*/schemas.ts`.
- Guards w `src/lib/api/guards.ts` (np. `requireTrainer`).
- Odpowiedzi JSON przez helpery w `src/lib/api/responses.ts`.
- Logika DB w serwisach `src/lib/*/service.ts` — współdzielona ze stronami `.astro`.

Nie ma osobnego procesu backendowego — API i strony to **ten sam deploy**, ten sam runtime Node na Vercel.

---

## Auth i middleware

`src/middleware.ts` działa jak globalny guard w NestJS:

- tworzy klienta Supabase z cookies requestu;
- ustawia `context.locals.user` i `context.locals.role`;
- chroni trasy z `PROTECTED_ROUTES` i `ROLE_PROTECTED_PREFIXES` (np. `/trainer/*` tylko dla roli `trainer`).

Klient Supabase (`src/lib/supabase.ts`) używa `@supabase/ssr` — sesja trzyma się w **httpOnly cookies**, nie w localStorage.

---

## Serverless functions

Po `npm run build` adapter Vercel generuje output w `.vercel/output/`. Każda strona SSR i każdy plik w `src/pages/api/` staje się **osobną serverless function**:

- kod uruchamia się **na żądanie** (per HTTP request);
- brak stałego serwera Node 24/7 — po bezruchu instancja „śpi”;
- skalowanie automatyczne; koszt zależy od liczby invokacji, nie od włączonego VPS-a;
- **cold start** — pierwsze wywołanie po przerwie może być wolniejsze;
- limity czasu wykonania (typowo dziesiątki sekund) — nie nadaje się do długich jobów ani WebSocketów w tym modelu.

W dev (`npm run dev`) wszystko działa na jednym lokalnym serwerze Vite/Astro (port 4321) — bez serverless, wygodniejsze debugowanie.

---

## Porównanie: Angular + NestJS vs trAInR (Astro)

| Aspekt              | Angular + NestJS                       | trAInR (Astro)               |
| ------------------- | -------------------------------------- | ---------------------------- |
| Procesy             | 2 aplikacje (FE + BE)                  | 1 aplikacja, 1 deploy        |
| Frontend            | SPA — routing w JS                     | SSR HTML + React islands     |
| Routing FE          | Angular Router                         | Pliki w `src/pages/`         |
| API                 | NestJS controllers                     | Pliki `src/pages/api/*.ts`   |
| Middleware / guards | NestJS Guards                          | `src/middleware.ts`          |
| Serwisy             | `@Injectable()`                        | Funkcje w `src/lib/`         |
| Walidacja           | class-validator / pipes                | Zod                          |
| Auth backend        | JWT / własna sesja                     | Supabase + cookies SSR       |
| Dev                 | 2 terminale (`ng serve`, `nest start`) | `npm run dev` — jeden serwer |
| Hosting BE          | VPS / kontener 24/7                    | Vercel serverless            |

**Analogia:** zamiast dwóch serwisów (Angular + NestJS) masz jeden projekt Astro, który renderuje strony i wystawia `/api/*` w tym samym runtime, a Supabase pełni rolę bazy i auth providera.

---

## Deployment

Pipeline (`.github/workflows/ci.yml`):

1. `npm ci`
2. `npx astro sync`
3. `npm run lint`
4. `npm run test`
5. `npm run build` (z sekretami Supabase z GitHub)
6. `npx vercel deploy --prebuilt` — preview na PR, production na push do `master`

Build produkcyjny wymaga `SUPABASE_URL` i `SUPABASE_KEY` (build-time dla Astro env schema). Te same zmienne muszą być ustawione w Vercel Dashboard dla runtime.

**Supabase** jest deployowany osobno (cloud project lub lokalnie przez `npx supabase start`). Migracje: `supabase/migrations/`.

---

## Kiedy SSR, kiedy API, kiedy React

| Potrzeba                            | Mechanizm                         |
| ----------------------------------- | --------------------------------- |
| Lista / widok tylko do odczytu      | Dane w frontmatter `.astro` (SSR) |
| Formularz, filtry, stan UI          | React island (`client:load`)      |
| Zapis / usuwanie / JSON dla klienta | `fetch` → `src/pages/api/*`       |
| Ochrona trasy                       | `middleware.ts`                   |
| Reguły dostępu do danych            | RLS w Supabase + guards w API     |

---

## Powiązane dokumenty

- [README.md](../README.md) — setup, skrypty, Supabase
- [AGENTS.md](../AGENTS.md) — konwencje dla agentów AI i contributorów
- [ERD.md](./ERD.md) — model danych
