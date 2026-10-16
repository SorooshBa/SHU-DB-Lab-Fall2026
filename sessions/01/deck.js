/* Session 01 — Environment Setup & Core T-SQL
   Data-only deck file: edit text here, never the engine.
   Result tables verified with tools/verify_answers.py — see tools/answers-verified.md. */

/* helpers for the logical-order diagram (pure string builders) */
function olBox(x, num, label) {
  return '<rect x="' + x + '" y="80" width="165" height="110" rx="14" fill="var(--surface)" stroke="var(--primary)" stroke-width="4"/>' +
    '<text x="' + (x + 82) + '" y="58" fill="var(--muted)" font-size="28" text-anchor="middle" font-family="system-ui, sans-serif">' + num + "</text>" +
    '<text x="' + (x + 82) + '" y="147" fill="var(--text)" font-size="30" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">' + label + "</text>";
}
function olArrow(x) {
  return '<line x1="' + (x + 170) + '" y1="135" x2="' + (x + 205) + '" y2="135" stroke="var(--primary)" stroke-width="5" marker-end="url(#o2)"/>';
}
var OL_BOXES = ["FROM", "WHERE", "GROUP BY", "HAVING", "SELECT", "DISTINCT", "ORDER BY", "TOP"]
  .map(function (label, i) {
    return olBox(15 + 210 * i, String(i + 1), label) + (i < 7 ? olArrow(15 + 210 * i) : "");
  }).join("");

window.DECK = {
  id: "s01",
  number: 1,
  title: "Environment Setup & Core T-SQL",
  subtitle: "SQL Server 2022, compared with PostgreSQL 16 and MySQL 8",
  durationMin: 120,
  brand: "DB Lab · Session 01",

  sections: [
    { id: "intro",     title: "Course intro",              start: 0,   minutes: 10 },
    { id: "env",       title: "Environment",               start: 10,  minutes: 20 },
    { id: "basics",    title: "SQL Server basics",         start: 30,  minutes: 15 },
    { id: "select",    title: "SELECT deep-dive",          start: 45,  minutes: 30 },
    { id: "functions", title: "Built-in functions",        start: 75,  minutes: 15 },
    { id: "dml",       title: "DML & DDL safely",          start: 90,  minutes: 10 },
    { id: "ext",       title: "Extended: bulk & extra",    start: 100, minutes: 5, tier: "extended" },
    { id: "dialect",   title: "Dialect corner & metadata", start: 105, minutes: 10 },
    { id: "homework",  title: "Wrap-up",                   start: 115, minutes: 5 }
  ],

  slides: [

    /* ============ 1 · Course intro (0:00–0:10) ============ */
    { type: "title", section: "intro",
      title: "Database Lab",
      subtitle: "Session 1 · Environment Setup & Core T-SQL",
      meta: ["Session 1 of 12", "120 minutes", "SQL Server 2022 (T-SQL)"],
      notes: "Welcome students, introduce yourself. Say the course is hands-on: every session ends with an exit quiz and homework. Grading and the project overview: cover verbally here (5 min) — the deck does not carry it." },

    { type: "table", section: "intro", title: "Today",
      head: ["Time", "Block"],
      rows: [
        ["0:00–0:10", "Course intro, grading, project overview"],
        ["0:10–0:30", "Environment: Docker, clients, load ShopDB"],
        ["0:30–0:45", "SQL Server basics: batches, types, scripting"],
        ["0:45–1:15", "SELECT deep-dive: filtering, NULL, paging, aggregates"],
        ["1:15–1:30", "Built-in functions: string, date/time, conversion"],
        ["1:30–1:45", "DML safely, DDL variants (+ bulk import)"],
        ["1:45–1:55", "Dialect corner, metadata, join teaser"],
        ["1:55–2:00", "Homework briefing"]
      ],
      caption: "**Core** = covered in class · **Extended** = demo fast or self-study · Running late? cut Extended first.",
      notes: "Point at the two long blocks (SELECT, environment). The press of C hides all Extended slides if we fall behind." },

    { type: "bullets", section: "intro", title: "What you will be able to do", stepwise: true,
      items: [
        "Run SQL Server, PostgreSQL and MySQL in Docker and connect with a client",
        "Explain batches, `GO`, schemas, collations and data types",
        "Write `SELECT` with filtering, sorting, paging, `CASE` and aggregation",
        "Explain three-valued logic — why `= NULL` returns nothing",
        "Do basic DML safely: transactions and `OUTPUT`"
      ],
      notes: "Read these fast; they come back at the exit quiz. Emphasise the logical processing order — it explains most beginner bugs." },

    { type: "quiz", section: "intro", title: "Warm-up · ShopDB",
      question: "Our sample database, `ShopDB` — how many tables does it contain?",
      options: ["2", "3", "4", "5"],
      correct: 2,
      explain: "`customers`, `products`, `orders`, `order_items` — four tables. You will load them next block.",
      notes: "Quick poll, hands up. Everyone who says 4 gets to pick the first challenge later. All session examples run against these four tables." },

    /* ============ 2 · Environment (0:10–0:30) ============ */
    { type: "section", section: "env", kicker: "Part 2 · 0:10–0:30",
      title: "Environment",
      blurb: "Docker containers, clients, and the ShopDB seed",
      notes: "Students run this on their own laptops. Have the docker-compose.yml and shop_seed_tsql.sql ready to share before you start." },

    { type: "code", section: "env", title: "Start the three engines", lang: "bash",
      code: [
        "# SQL Server 2022 (primary) — needs >= 2 GB RAM",
        "docker run -e \"ACCEPT_EULA=Y\" -e \"MSSQL_SA_PASSWORD=Str0ng!Passw0rd\" \\",
        "  -p 1433:1433 --name mssql -d mcr.microsoft.com/mssql/server:2022-latest",
        "",
        "# dialect corners",
        "docker run --name pg    -e POSTGRES_PASSWORD=secret   -p 5432:5432 -d postgres:16",
        "docker run --name mysql -e MYSQL_ROOT_PASSWORD=secret -p 3306:3306 -d mysql:8"
      ],
      caption: "Apple Silicon: enable Rosetta emulation in Docker Desktop — or use the provided `docker-compose.yml`.",
      notes: "Give everyone the compose file so nobody types these by hand. First SQL Server start takes 20-30 seconds; use the time to introduce the clients." },

    { type: "quiz", section: "env", title: "Pick your tool",
      question: "You are on Windows and want the full-featured GUI. Which client?",
      options: ["SSMS", "VS Code + MSSQL extension", "DBeaver", "sqlcmd"],
      correct: 0,
      explain: "**SSMS** is Windows-only and the fullest GUI. VS Code + MSSQL is cross-platform and lightweight; DBeaver talks to all three DBMSs; `sqlcmd` is the CLI for scripts and CI.",
      notes: "Session file: SSMS (Windows), VS Code + MSSQL (cross-platform), DBeaver (all three), sqlcmd (CLI). Azure Data Studio is retired — tell students not to install it." },

    { type: "demo", section: "env", title: "Load ShopDB", switchTo: "Terminal / SSMS", stepwise: true,
      steps: [
        "Start the engines: `docker compose --profile core up -d`",
        "Check they are up: `docker ps` shows mssql, pg, mysql",
        "Connect: `sqlcmd -S localhost -U sa -P 'Str0ng!Passw0rd' -C`",
        "Run `shop_seed_tsql.sql` — it creates and fills the four tables",
        "Verify: 8 customers · 12 products · 14 orders · 25 order items",
        "Keep a client open — every exercise today uses ShopDB"
      ],
      notes: "-C trusts the dev certificate. If a student's SQL Server container dies, `docker restart mssql` is usually enough. The row counts come from the last query in the seed file." },

    { type: "challenge", section: "env", id: "setup-order", kind: "order",
      title: "Your turn: set up your machine",
      prompt: "Put these steps in the order they must happen on a fresh laptop.",
      items: [
        "Run `shop_seed_tsql.sql` in your client",
        "Start the containers (Docker)",
        "Verify the row counts (8 / 12 / 14 / 25)",
        "Connect a client (SSMS / VS Code / sqlcmd)"
      ],
      thinkMinutes: 2,
      hints: ["Nothing works before the server itself is running.", "The seed file talks to a database that must already exist."],
      answer: {
        items: [
          "Start the containers (Docker) — the server must be running",
          "Connect a client — you need a session to the server",
          "Run `shop_seed_tsql.sql` — create and fill the tables",
          "Verify the row counts — catch a silent failure early"
        ],
        explain: ["Server first, then session, then schema, then a sanity check."],
        pitfalls: "Students who skip verification discover it as weird errors an hour later."
      },
      notes: "Ask someone to read their order out loud. Common wrong answer: running the seed before connecting." },

    /* ============ 3 · SQL Server basics (0:30–0:45) ============ */
    { type: "section", section: "basics", kicker: "Part 3 · 0:30–0:45",
      title: "SQL Server basics",
      blurb: "Hierarchy · batches · data types · collation · scripting",
      notes: "15 minutes, two short blocks: objects and types, then variables. Keep the SET-vs-SELECT challenge for the end of the block." },

    { type: "diagram", section: "basics", title: "Where your table lives",
      svg:
        '<svg viewBox="0 0 1700 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="instance to database to schema to object">' +
        '<defs><marker id="o1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
        '<path d="M0 0 L10 5 L0 10 z" fill="var(--primary)"/></marker></defs>' +
        '<g font-family="system-ui, sans-serif" text-anchor="middle">' +
        '<rect x="30" y="130" width="360" height="160" rx="18" fill="var(--surface)" stroke="var(--border)" stroke-width="4"/>' +
        '<text x="210" y="195" fill="var(--muted)" font-size="30">instance</text>' +
        '<text x="210" y="250" fill="var(--text)" font-size="42" font-weight="700">SQL Server</text>' +
        '<rect x="470" y="130" width="360" height="160" rx="18" fill="var(--surface)" stroke="var(--primary)" stroke-width="4"/>' +
        '<text x="650" y="195" fill="var(--muted)" font-size="30">database</text>' +
        '<text x="650" y="250" fill="var(--text)" font-size="42" font-weight="700">ShopDB</text>' +
        '<rect x="910" y="130" width="360" height="160" rx="18" fill="var(--surface)" stroke="var(--primary)" stroke-width="4"/>' +
        '<text x="1090" y="195" fill="var(--muted)" font-size="30">schema (default)</text>' +
        '<text x="1090" y="250" fill="var(--text)" font-size="42" font-weight="700">dbo</text>' +
        '<rect x="1350" y="130" width="330" height="160" rx="18" fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="4"/>' +
        '<text x="1515" y="195" fill="var(--muted)" font-size="30">object</text>' +
        '<text x="1515" y="250" fill="var(--text)" font-size="42" font-weight="700">customers</text>' +
        '<line x1="395" y1="210" x2="460" y2="210" stroke="var(--primary)" stroke-width="5" marker-end="url(#o1)"/>' +
        '<line x1="835" y1="210" x2="900" y2="210" stroke="var(--primary)" stroke-width="5" marker-end="url(#o1)"/>' +
        '<line x1="1275" y1="210" x2="1340" y2="210" stroke="var(--primary)" stroke-width="5" marker-end="url(#o1)"/>' +
        '<text x="850" y="380" fill="var(--question)" font-size="34" font-weight="700">Always schema-qualify: dbo.customers</text>' +
        "</g></svg>",
      notes: "Instance > database > schema > object. Default schema is dbo. Unqualified names resolve against your default schema first — that is why we always write dbo.customers." },

    { type: "challenge", section: "basics", id: "go-batch", kind: "predict",
      title: "Predict: what happens after GO?",
      prompt: "Run this batch in SSMS. What happens on the last line?",
      context: {
        lang: "sql",
        code: ["DECLARE @n INT = 1;", "GO", "SELECT @n;"]
      },
      thinkMinutes: 1,
      hints: ["What does GO actually tell the client tool?", "Batches are compiled separately."],
      answer: {
        text: "**Error: must declare the scalar variable \"@n\".** The `GO` ended the batch — `@n` died with it.",
        explain: [
          "`GO` is a **client** command (SSMS, `sqlcmd`) — the server never parses it.",
          "`CREATE PROCEDURE` / `CREATE VIEW` must be the first statement in their batch.",
          "Variables live inside one batch only."
        ],
        pitfalls: "`GO` is not T-SQL. Writing it in a procedure or in another tool's driver fails."
      },
      notes: "Run it live if a student doubts the error. The classic variation: SET @n = ... after GO. This is the self-check quiz question about GO in practical form." },

    { type: "table", section: "basics", title: "Data types you must know",
      head: ["Need", "Use", "Avoid"],
      rows: [
        ["Unicode text", "`NVARCHAR(n)` — Persian names!", "`VARCHAR` for non-Latin text"],
        ["Money", "`DECIMAL(p,s)`", "`FLOAT`; `MONEY` for precision math"],
        ["Date / time", "`DATE`, `DATETIME2(n)`", "legacy `DATETIME` (3 ms rounding)"],
        ["Flag", "`BIT`", "`CHAR(1)` with Y/N"],
        ["GUID", "`UNIQUEIDENTIFIER`", "as clustered key (Session 8)"]
      ],
      caption: "Rule of thumb: Unicode for text, DECIMAL for money, DATETIME2 for time.",
      notes: "Persian names in VARCHAR come back as ??? — show it live if someone has non-ASCII data. FLOAT is fine for science, never for invoices." },

    { type: "split", section: "basics", title: "Collation and literals",
      left: {
        bullets: [
          "Default collation is **case-insensitive**: `LIKE 'a%'` matches `Ali`",
          "Case-sensitive compare needs `COLLATE Latin1_General_CS_AS`",
          "Prefix Unicode literals with `N` — or Persian text turns into `?`"
        ]
      },
      right: {
        lang: "sql",
        code: [
          "SELECT name FROM dbo.customers",
          "WHERE name = 'ali rezaei';      -- CI: matches",
          "",
          "SELECT N'سروش';                 -- needs the N prefix"
        ]
      },
      notes: "Collation decides case AND accent sensitivity: SQL_Latin1_General_CP1_CI_AS. Sorting 'a' vs 'A' is invisible until it is not (product codes, logins)." },

    { type: "code", section: "basics", title: "Variables and control flow", lang: "sql",
      code: [
        "DECLARE @city NVARCHAR(50) = N'Tehran', @n INT;",
        "SELECT @n = COUNT(*) FROM dbo.customers WHERE city = @city;",
        "",
        "IF @n > 2 PRINT CONCAT(@city, ' has ', @n, ' customers');",
        "ELSE      PRINT 'few customers';",
        "",
        "DECLARE @i INT = 1;",
        "WHILE @i <= 3",
        "BEGIN",
        "    PRINT CONCAT('iteration ', @i);",
        "    SET @i += 1;",
        "END;"
      ],
      caption: "`@@ROWCOUNT` = rows touched by the previous statement · `IIF(cond, a, b)` and `CHOOSE(i, a, b, c)` for inline conditionals.",
      notes: "PRINT goes to the messages pane; a SELECT goes to the result grid. Show the loop running once — then move on, scripting depth comes later in the course." },

    { type: "challenge", section: "basics", id: "set-select", kind: "predict",
      title: "Predict: SET or SELECT?",
      prompt: "What does SQL Server do when this batch runs?",
      context: {
        lang: "sql",
        code: [
          "DECLARE @price DECIMAL(10,2);",
          "SET @price = (SELECT price FROM dbo.products);",
          "SELECT @price AS one_price;"
        ]
      },
      thinkMinutes: 2,
      hints: ["How many rows are in dbo.products?", "A scalar subquery must return exactly one value."],
      answer: {
        text: "**Error: subquery returned more than 1 row.** `SET @x = (SELECT …)` demands exactly one row (zero is allowed).",
        explain: [
          "`SET @price = (SELECT …)` — scalar context: 0 or 1 rows.",
          "`SELECT @price = price FROM …` would **silently keep the last row** — the sneakier bug.",
          "Neither is wrong if you added a WHERE or TOP on purpose."
        ],
        pitfalls: "The SELECT-assignment version never errors on too many rows — it just answers with whatever row finished last."
      },
      notes: "This is the classic bug from the session file. Run the SELECT-assignment variant live so students see it 'working' with an arbitrary row." },

    /* ============ 4 · SELECT deep-dive (0:45–1:15) ============ */
    { type: "section", section: "select", kicker: "Part 4 · 0:45–1:15",
      title: "SELECT deep-dive",
      blurb: "Filtering · NULL logic · paging · CASE · aggregates",
      notes: "The heart of the session: 30 minutes, five challenges. If the room is slow, run CASE-buckets as a whole-class exercise instead of individual work." },

    { type: "code", section: "select", title: "First N rows", lang: "sql",
      code: [
        "SELECT TOP (5) name, price FROM dbo.products",
        "ORDER BY price DESC;",
        "",
        "SELECT TOP (5) WITH TIES name, price FROM dbo.products",
        "ORDER BY price DESC;   -- rows tied with #5 come too"
      ],
      caption: "`TOP` without `ORDER BY` is arbitrary — the engine picks any 5 rows.",
      notes: "Contrast with PostgreSQL/MySQL LIMIT: same idea, different spelling. WITH TIES needs ORDER BY as well; we prove it with the next challenge." },

    { type: "challenge", section: "select", id: "top5", kind: "write",
      title: "Your turn: the five most expensive products",
      prompt: "Return the **name** and **price** of the five most expensive products. Include ties.",
      context: { schema: "shop" },
      thinkMinutes: 3,
      hints: ["Which keyword limits rows in T-SQL?", "Write it as `TOP (5) WITH TIES`. Ties share the cut-off price."],
      answer: {
        lang: "sql",
        code: [
          "SELECT TOP (5) WITH TIES name, price",
          "FROM dbo.products",
          "ORDER BY price DESC;"
        ],
        result: {
          head: ["name", "price"],
          rows: [
            ["Laptop Pro 14", "1200.00"],
            ["27in Monitor", "220.00"],
            ["Office Chair", "150.00"],
            ["Mechanical Keyboard", "80.00"],
            ["USB-C Hub", "45.00"]
          ]
        },
      explain: [
        "`TOP` needs `ORDER BY` to be meaningful.",
        "No price repeats at rank 5 in this seed, so `WITH TIES` returns exactly 5 rows — on bigger data it can return more."
      ],
        pitfalls: "`LIMIT 5` is PostgreSQL/MySQL, not T-SQL."
      },
      notes: "Walk the room while they type. Most mistakes: LIMIT vs TOP, or a missing ORDER BY. The schema chip shows the four tables." },

    { type: "code", section: "select", title: "Paging with OFFSET … FETCH", lang: "sql",
      code: [
        "-- page 1 (4 per page)",
        "SELECT name, price FROM dbo.products",
        "ORDER BY price DESC",
        "OFFSET 0 ROWS FETCH NEXT 4 ROWS ONLY;",
        "",
        "-- page 2",
        "SELECT name, price FROM dbo.products",
        "ORDER BY price DESC",
        "OFFSET 4 ROWS FETCH NEXT 4 ROWS ONLY;"
      ],
      caption: "`ORDER BY` is mandatory — paging without one gives different rows on every run.",
      notes: "OFFSET/FETCH is ANSI: PostgreSQL and MySQL spell it LIMIT n OFFSET m. Row_number over a subquery is the legacy way — Session 5." },

    { type: "challenge", section: "select", id: "page2", kind: "write",
      title: "Your turn: page 2 of products",
      prompt: "Return **page 2** of the products, **4 rows per page**, ordered from most to least expensive.",
      context: { schema: "shop" },
      thinkMinutes: 3,
      hints: ["Skip the first page's worth of rows.", "OFFSET 4 ROWS FETCH NEXT 4 ROWS ONLY."],
      answer: {
        lang: "sql",
        code: [
          "SELECT name, price FROM dbo.products",
          "ORDER BY price DESC",
          "OFFSET 4 ROWS FETCH NEXT 4 ROWS ONLY;"
        ],
        result: {
          head: ["name", "price"],
          rows: [
            ["USB-C Hub", "45.00"],
            ["Database Design", "35.00"],
            ["NoSQL Distilled", "30.00"],
            ["Desk Lamp", "28.00"]
          ]
        },
        explain: ["Page 1 rows 1-4 are skipped by OFFSET; FETCH takes the next 4.", "Page numbers are 0-based here: page 2 starts at offset 4."],
        pitfalls: "Students write OFFSET 2 ROWS for page 2 — offsets count rows, not pages."
      },
      notes: "Verified: page 2 = prices 45, 35, 30, 28. If the class finishes early, ask for page 3 as a bonus." },

    { type: "code", section: "select", title: "NULL helpers: ISNULL, COALESCE, CASE", lang: "sql",
      code: [
        "SELECT name, city, phone,",
        "       ISNULL(phone, 'N/A')                     AS phone_or_na,  -- T-SQL, type of 1st arg",
        "       COALESCE(phone, city, 'unknown')         AS first_non_null, -- ANSI, first non-NULL",
        "       CASE WHEN city = N'Tehran' THEN 'capital'",
        "            ELSE 'other' END                    AS tag",
        "FROM dbo.customers;"
      ],
      caption: "`ISNULL` is T-SQL; `COALESCE` is ANSI and takes many arguments.",
      notes: "COALESCE(shortest) is equivalent to nested ISNULL for two arguments. Types differ — Extended exercise 10 shows the trap." },

    { type: "split", section: "select", title: "Three-valued logic: NULL",
      left: {
        bullets: [
          "Comparing with NULL gives **UNKNOWN**, never TRUE",
          "`WHERE` keeps only rows that are **TRUE**",
          "`NOT (city = …)` also drops rows where city IS NULL",
          "Use `IS NULL` / `IS NOT NULL` explicitly"
        ]
      },
      right: {
        lang: "sql",
        code: [
          "-- = NULL: no error, but 0 rows",
          "SELECT * FROM dbo.customers WHERE phone = NULL;",
          "-- IS NULL: the 3 customers without a phone",
          "SELECT * FROM dbo.customers WHERE phone IS NULL;",
          "-- NOT (...) drops NULL cities too",
          "SELECT * FROM dbo.customers",
          "WHERE NOT (city = N'Tehran');"
        ]
      },
      notes: "= NULL is not a typo students make once — it returns zero rows WITHOUT an error, so it looks like empty data. Emphasise: no error, silent wrong answer." },

    { type: "diagram", section: "select", title: "Logical processing order",
      svg:
        '<svg viewBox="0 0 1700 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FROM WHERE GROUP BY HAVING SELECT DISTINCT ORDER BY TOP">' +
        '<defs><marker id="o2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">' +
        '<path d="M0 0 L10 5 L0 10 z" fill="var(--primary)"/></marker></defs>' +
        OL_BOXES +
        '<text x="850" y="270" fill="var(--question)" font-size="32" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">' +
        "WHERE cannot see SELECT aliases — ORDER BY can</text>" +
        "</svg>",
      notes: "Draw it once on the whiteboard too. The sequence FROM > WHERE > GROUP BY > HAVING > SELECT > DISTINCT > ORDER BY > TOP/OFFSET is the single best explanation for alias rules." },

    { type: "challenge", section: "select", id: "alias-bug", kind: "spot-the-bug",
      title: "Spot the bug: alias in WHERE",
      prompt: "SQL Server rejects this query. Where is the bug, and how do you fix it?",
      context: {
        lang: "sql",
        code: [
          "SELECT name, price * 1.1 AS new_price",
          "FROM dbo.products",
          "WHERE new_price > 100;"
        ]
      },
      thinkMinutes: 2,
      hints: ["Which clause runs before SELECT?", "Aliases do not exist yet in WHERE."],
      answer: {
        lang: "sql",
        code: [
          "SELECT name, price * 1.1 AS new_price",
          "FROM dbo.products",
          "WHERE price * 1.1 > 100;"
        ],
        highlightLines: [3],
        explain: [
          "`WHERE` is evaluated **before** `SELECT` — the alias `new_price` does not exist yet.",
          "`ORDER BY` runs after `SELECT`, so an alias **is** allowed there.",
          "Same reason the alias is rejected in `GROUP BY`."
        ],
        pitfalls: "Error text is roughly: Invalid column name 'new_price'. Run it live for the exact wording."
      },
      notes: "Ask: which clause could use the alias? Only ORDER BY (and sometimes TOP/queries in some engines). This is exit-quiz question 3 in practical form." },

    { type: "code", section: "select", title: "Aggregation with GROUP BY / HAVING", lang: "sql",
      code: [
        "SELECT category, COUNT(*) AS n,",
        "       MIN(price) AS min_price, MAX(price) AS max_price",
        "FROM dbo.products",
        "GROUP BY category",
        "HAVING COUNT(*) >= 3",
        "ORDER BY n DESC;"
      ],
      result: {
        head: ["category", "n", "min_price", "max_price"],
        rows: [
          ["Electronics", "5", "15.00", "1200.00"],
          ["Books", "3", "25.00", "35.00"]
        ]
      },
      caption: "`COUNT(col)` skips NULLs · `AVG` on an `INT` divides as integers — cast first.",
      notes: "AVG(price) is fine here (DECIMAL), but AVG(qty) on an INT column truncates: 74/25 = 2, not 2.96. COUNT(*) counts rows, COUNT(phone) counts phones (5 of 8)." },

    { type: "challenge", section: "select", id: "cities", kind: "write",
      title: "Your turn: cities with a crowd",
      prompt: "Which **cities** have **two or more customers**? Return the city and the count, busiest first.",
      context: { schema: "shop" },
      thinkMinutes: 3,
      hints: ["GROUP BY city.", "WHERE cannot see aggregates — filter groups afterwards."],
      answer: {
        lang: "sql",
        code: [
          "SELECT city, COUNT(*) AS n",
          "FROM dbo.customers",
          "GROUP BY city",
          "HAVING COUNT(*) >= 2",
          "ORDER BY n DESC;"
        ],
        result: { head: ["city", "n"], rows: [["Tehran", "3"], ["Shiraz", "2"]] },
        explain: ["`WHERE` filters rows, `HAVING` filters groups.", "Tehran has Ali, Omid and Maryam; Shiraz has Sara and Arash."],
        pitfalls: "WHERE n >= 2 fails: aggregates are not visible to WHERE."
      },
      notes: "Five students get this right immediately; pair them with someone who does not. Verified: Tehran 3, Shiraz 2." },

    { type: "challenge", section: "select", id: "groupby-full", kind: "predict",
      title: "Predict: which engine accepts this?",
      prompt: "Run this on SQL Server. What happens — and would MySQL accept it?",
      context: {
        lang: "sql",
        code: ["SELECT category, price FROM dbo.products", "GROUP BY category;"]
      },
      thinkMinutes: 2,
      hints: ["Is price aggregated or grouped?", "What does MySQL 8 default to?"],
      answer: {
        text: "**SQL Server rejects it** — `price` is neither in `GROUP BY` nor aggregated. MySQL 8 with its default `ONLY_FULL_GROUP_BY` rejects it too; older MySQL silently returned *some* row's price.",
        explain: [
          "Every selected column must be grouped or aggregated (or be in a function over the group).",
          "MySQL's old default hid this bug for years — a plausible-looking wrong number."
        ],
        pitfalls: "Exact error text differs by version — run it live. Never rely on engine A accepting what engine B rejects."
      },
      notes: "In-class exercise 6. If MySQL is running, run it there too and show sql_mode = ONLY_FULL_GROUP_BY." },

    { type: "challenge", section: "select", id: "isnull-coalesce", kind: "write",
      title: "Your turn: show the missing phones",
      prompt: "Return every customer **without a phone**, showing `name` and the phone as `'N/A'`. Write it **twice**: once with `ISNULL`, once with `COALESCE`.",
      context: { schema: "shop" },
      thinkMinutes: 3,
      hints: ["Filter first: WHERE phone IS NULL.", "Both functions take (value, fallback)."],
      answer: {
        lang: "sql",
        code: [
          "SELECT name,",
          "       ISNULL(phone, 'N/A')    AS with_isnull,",
          "       COALESCE(phone, 'N/A')  AS with_coalesce",
          "FROM dbo.customers",
          "WHERE phone IS NULL;"
        ],
        result: {
          head: ["name", "with_isnull", "with_coalesce"],
          rows: [
            ["Omid Hosseini", "N/A", "N/A"],
            ["Reza Moradi", "N/A", "N/A"],
            ["Arash Naderi", "N/A", "N/A"]
          ]
        },
        explain: [
          "Both give the same text here — the fallback fits in `VARCHAR(20)`.",
          "`COALESCE` is ANSI and accepts many arguments.",
          "`ISNULL` returns the **type of its first argument** — see the Extended exercise."
        ],
        pitfalls: "A replacement longer than the first argument's type gets truncated by ISNULL."
      },
      notes: "In-class exercise 3. Three customers: Omid, Reza, Arash. The ISNULL truncation is exercise 10 — you will meet it in the Extended block." },

    { type: "challenge", section: "select", id: "case-buckets", kind: "write",
      title: "Your turn: price buckets",
      prompt: "Bucket every product: **cheap** (< 20), **mid** (20–100), **premium** (> 100). Count each bucket.",
      context: { schema: "shop" },
      thinkMinutes: 3,
      hints: ["CASE returns a value per row.", "You can GROUP BY an expression — but not by a SELECT alias."],
      answer: {
        lang: "sql",
        code: [
          "SELECT CASE WHEN price < 20 THEN 'cheap'",
          "            WHEN price <= 100 THEN 'mid' ELSE 'premium' END",
          "       AS bucket, COUNT(*) AS n",
          "FROM dbo.products",
          "GROUP BY CASE WHEN price < 20 THEN 'cheap'",
          "              WHEN price <= 100 THEN 'mid' ELSE 'premium' END;"
        ],
        result: { head: ["bucket", "n"], rows: [["cheap", "3"], ["mid", "6"], ["premium", "3"]] },
      explain: [
        "The CASE expression is repeated in GROUP BY — SQL Server has no SELECT alias there.",
        "ELSE catches everything above 100, so premium is > 100.",
        "Add `ORDER BY bucket` if you rely on the output order."
      ],
        pitfalls: "Wrap it in a CTE or subquery to avoid repeating the CASE: SELECT bucket, COUNT(*) FROM (…) x GROUP BY bucket."
      },
      notes: "In-class exercise 5. Verified counts: cheap 3 (mouse, notebook, gel pen), mid 6, premium 3 (monitor, laptop, chair)." },

    { type: "compare", section: "select", title: "Dialect corner: first N rows", revealRows: true,
      columns: [
        { key: "mssql", label: "SQL Server", primary: true },
        { key: "pg", label: "PostgreSQL" },
        { key: "my", label: "MySQL" }
      ],
      rows: [
        { label: "Top 5",
          cells: { mssql: "`SELECT TOP (5) …`", pg: "`… LIMIT 5`", my: "`… LIMIT 5`" } },
        { label: "Page 2, size 5",
          cells: { mssql: "`… OFFSET 5 ROWS FETCH NEXT 5 ROWS ONLY`", pg: "`… LIMIT 5 OFFSET 5`", my: "`… LIMIT 5 OFFSET 5`" } }
      ],
      caption: "SQL Server first — TOP is T-SQL's own spelling; OFFSET … FETCH is the ANSI form all three accept (MySQL 8+).",
      notes: "Reveal row by row. OFFSET/FETCH works in MySQL 8 and PostgreSQL as well — it is the portable spelling." },

    /* ============ 5 · Built-in functions (1:15–1:30) ============ */
    { type: "section", section: "functions", kicker: "Part 5 · 1:15–1:30",
      title: "Built-in functions",
      blurb: "Strings · date/time · conversion — the ones you use daily",
      notes: "Hand out the session file's function list as a cheat-sheet if you are running late — do not live-code all of it." },

    { type: "code", section: "functions", title: "String functions", lang: "sql",
      code: [
        "SELECT LEN(N'سروش   ')     AS len_chars,      -- characters, trailing spaces ignored",
        "       DATALENGTH(N'سروش') AS bytes,          -- bytes: NVARCHAR = 2 per char",
        "       TRIM(N'  x  '), UPPER(N'abc'),",
        "       REPLACE(N'a-b-c', N'-', N''),",
        "       CHARINDEX(N'@', N'ali@example.com')    AS at_pos,",
        "       SUBSTRING(N'ali@example.com', 1, 3)    AS first3;",
        "SELECT value FROM STRING_SPLIT(N'db,sql,nosql', N',');  -- one row per item"
      ],
      caption: "`LEN` counts characters · `DATALENGTH` counts bytes · `SUBSTRING(text, start, length)` — start is 1-based.",
      notes: "Persian sample data appears here on purpose: NVARCHAR stores 2 bytes per character, VARCHAR stores 1 and mangles non-ASCII." },

    { type: "challenge", section: "functions", id: "charindex", kind: "predict",
      title: "Predict: where is the @?",
      prompt: "What does `at_pos` show?",
      context: { lang: "sql", code: ["SELECT CHARINDEX(N'@', N'ali@example.com') AS at_pos;"] },
      thinkMinutes: 1,
      hints: ["CHARINDEX is 1-based.", "Count: a-l-i-@ …"],
      answer: {
        result: { head: ["at_pos"], rows: [["4"]] },
        explain: ["Positions start at 1, not 0 — `a` is position 1, `@` is position 4.", "Not found would return 0 (not NULL)."],
        pitfalls: "0 means 'not found' — wrap in NULLIF when you use it in SUBSTRING arithmetic."
      },
      notes: "One-minute confidence builder. The e-mail parsing pattern CHARINDEX + SUBSTRING returns in exercise 7." },

    { type: "code", section: "functions", title: "Date and time", lang: "sql",
      code: [
        "SELECT SYSDATETIME()                                  AS local_now,",
        "       DATEADD(MONTH, 1, CAST('2026-10-11' AS DATE)) AS next_month,",
        "       DATEDIFF(DAY, '2026-01-01', '2026-10-11')     AS days_elapsed,",
        "       EOMONTH('2026-10-11')                          AS month_end,",
        "       DATETRUNC(MONTH, CAST('2026-10-11' AS DATE))  AS month_start;  -- 2022+"
      ],
      caption: "No Jalali calendar in SQL Server — store Gregorian `DATE`/`DATETIME2`, convert for display in the application.",
      notes: "Also: avoid FORMAT() on large tables (CLR call per row) — use CONVERT or DATEPART. DATEPART(WEEKDAY) depends on SET DATEFIRST (Iran: week starts Saturday). DATEDIFF counts boundaries — next challenge." },

    { type: "code", section: "functions", title: "Conversion and arithmetic", lang: "sql",
      code: [
        "SELECT CAST(12.9 AS INT)                          AS truncated,   -- 12, not 13",
        "       TRY_CONVERT(INT, 'abc')                    AS bad_int,     -- NULL, no error",
        "       TRY_CONVERT(DATE, '2026-13-45')            AS bad_date,    -- NULL",
        "       5/2 AS int_div, 5/2.0 AS dec_div, 5%2 AS modulo,",
        "       ROUND(2.567, 1), CEILING(2.1), FLOOR(2.9);"
      ],
      caption: "`TRY_CONVERT` returns NULL instead of throwing — the safe way to validate dirty text.",
      notes: "CAST truncates toward zero: 12.9 -> 12. Integer division is exit-quiz question 2. TRY_* functions are what the staging pattern (later) validates rows with." },

    { type: "challenge", section: "functions", id: "datediff", kind: "predict",
      title: "Predict: the New Year trap",
      prompt: "What does this return? Why is the answer surprising?",
      context: { lang: "sql", code: ["SELECT DATEDIFF(YEAR, '2025-12-31', '2026-01-01');"] },
      thinkMinutes: 1,
      hints: ["The two dates are ONE day apart.", "What does DATEDIFF actually count?"],
      answer: {
        result: { head: ["DATEDIFF(YEAR, …)"], rows: [["1"]] },
        explain: [
          "`DATEDIFF` counts **boundaries crossed**, not full periods elapsed.",
          "One day across New Year counts as a whole year — same for MONTH and QUARTER."
        ],
        pitfalls: "`DATEDIFF(YEAR, '2026-01-01', '2026-12-31')` returns 0 — no boundary was crossed."
      },
      notes: "From the session notes: 'counts boundaries crossed, not full years'. Students building ageing reports get this wrong constantly." },

    /* ============ 6 · DML safely (1:30–1:40 core) ============ */
    { type: "section", section: "dml", kicker: "Part 6 · 1:30–1:45",
      title: "DML & DDL safely",
      blurb: "Transactions, OUTPUT, DELETE vs TRUNCATE, DDL variants",
      notes: "Ten minutes of Core here; the bulk-import half of this agenda block is the next (Extended) section." },

    { type: "code", section: "dml", title: "Change data inside a transaction", lang: "sql",
      code: [
        "BEGIN TRAN;",
        "UPDATE dbo.products SET price = price * 1.1",
        "WHERE category = N'Books'",
        "OUTPUT deleted.product_id, deleted.price AS old_price,",
        "       inserted.price AS new_price;",
        "-- check the OUTPUT rows …",
        "ROLLBACK;   -- or COMMIT when you are sure"
      ],
      caption: "`OUTPUT` shows the before (`deleted`) and after (`inserted`) image of every changed row.",
      notes: "Repeat the ritual: BEGIN TRAN, small change, look, then COMMIT or ROLLBACK. Never start a big UPDATE without it." },

    { type: "demo", section: "dml", title: "The scariest one-liner", switchTo: "SSMS / VS Code", stepwise: true,
      steps: [
        "Start a transaction: `BEGIN TRAN;`",
        "Run `DELETE FROM dbo.orders;` — no WHERE",
        "Check `SELECT @@ROWCOUNT;` — 14, every row is gone",
        "`ROLLBACK;` — and they are all back",
        "Lesson: always a WHERE, always a transaction while exploring"
      ],
      notes: "Make a show of it: count the rows before and after the rollback. This demo is why the next challenge says 14." },

    { type: "challenge", section: "dml", id: "delete-predict", kind: "predict",
      title: "Predict: every order, then undo",
      prompt: "What does this print, and how many orders exist after the ROLLBACK?",
      context: {
        lang: "sql",
        code: [
          "BEGIN TRAN;",
          "DELETE FROM dbo.orders;              -- no WHERE!",
          "PRINT CONCAT('deleted: ', @@ROWCOUNT);",
          "ROLLBACK;",
          "SELECT COUNT(*) AS orders_left FROM dbo.orders;"
        ]
      },
      thinkMinutes: 2,
      hints: ["How many orders does the seed load?", "What does ROLLBACK undo?"],
      answer: {
        result: { head: ["orders_left"], rows: [["14"]] },
        explain: [
          "`PRINT` shows **deleted: 14** — the whole table.",
          "After `ROLLBACK`, `orders_left` is **14** again: the delete never became durable.",
          "`@@ROWCOUNT` belongs to the statement that just finished (the DELETE)."
        ],
        pitfalls: "Without BEGIN TRAN (autocommit) each DELETE commits itself — there is nothing to roll back."
      },
      notes: "Verified: the seed loads 14 orders. Students who answer '0 rows left' missed the ROLLBACK." },

    { type: "table", section: "dml", title: "DELETE vs TRUNCATE",
      head: ["", "DELETE", "TRUNCATE"],
      rows: [
        ["Filtering", "Any `WHERE`", "Whole table — no `WHERE`"],
        ["Logging", "Row by row (logged)", "Minimal logging — much faster"],
        ["IDENTITY", "Keeps the current seed", "Resets and reseeds"],
        ["Foreign keys", "Works", "Blocked if a foreign key points here"]
      ],
      caption: "Both are undoable inside a transaction — when you actually opened one.",
      notes: "TRUNCATE is metadata-only: deallocate the data pages. That is why it cannot filter and why FKs (which expect to cascade or check) block it." },

    { type: "challenge", section: "dml", id: "truncate-choose", kind: "choose",
      title: "Decide: which statement?",
      prompt: "(a) Empty `dbo.todo` fast — nothing references it, restart the counter. (b) Remove only the `cancelled` orders. Which pair of statements?",
      options: [
        "(a) TRUNCATE, (b) DELETE",
        "(a) DELETE, (b) TRUNCATE",
        "TRUNCATE for both",
        "DELETE for both"
      ],
      correct: 0,
      thinkMinutes: 2,
      hints: ["Which one can take a WHERE?", "Which one resets the identity counter?"],
      answer: {
        text: "(a) **`TRUNCATE TABLE dbo.todo;`** — minimal logging, resets the identity, nothing references it. (b) **`DELETE FROM dbo.orders WHERE status = 'cancelled';`** — TRUNCATE cannot filter.",
        explain: [
          "TRUNCATE is all-or-nothing and deallocated pages — fast but inflexible.",
          "A filtered removal is always DELETE, inside a transaction."
        ],
        pitfalls: "If a foreign key pointed at dbo.todo, TRUNCATE would fail — use DELETE then."
      },
      notes: "Ask a student to justify (a) out loud before revealing. The justification matters more than the letter." },

    { type: "code", section: "dml", title: "DDL variants and friends", lang: "sql",
      code: [
        "CREATE TABLE dbo.todo (id INT IDENTITY CONSTRAINT pk_todo PRIMARY KEY,",
        "    title NVARCHAR(100) NOT NULL,",
        "    done BIT NOT NULL CONSTRAINT df_todo_done DEFAULT 0);",
        "ALTER TABLE dbo.todo ADD due DATE NULL;",
        "INSERT dbo.todo (title) VALUES (N'write report'), (N'review PR');  -- multi-row",
        "INSERT dbo.todo (title) SELECT name FROM dbo.products WHERE category = N'Books';",
        "SELECT * INTO dbo.products_copy FROM dbo.products WHERE category = N'Books';",
        "DROP TABLE IF EXISTS dbo.todo, dbo.products_copy;"
      ],
      caption: "`SELECT INTO` creates the table but **not** its constraints or indexes (identity is kept). Need the new key? `INSERT … OUTPUT inserted.<pk>` — or `SCOPE_IDENTITY()`, never `@@IDENTITY`.",
      notes: "Constraints live in the CREATE (named inline for clarity). OUTPUT on INSERT is the clean way to get generated keys; @@IDENTITY can see a trigger's identity in another table." },

    /* ============ 7 · Extended: bulk & extra practice (1:40–1:45) ============ */
    { type: "section", section: "ext", tier: "extended",
      kicker: "Extended · 1:40–1:45",
      title: "Bulk import & extra practice",
      blurb: "Demo fast or leave as self-study — press C to hide all of it",
      notes: "Running late? Skip this whole section (or press C for Core-only mode). Everything here is written up in the session file as self-study." },

    { type: "code", section: "ext", tier: "extended", title: "BULK INSERT", lang: "sql",
      code: [
        "CREATE TABLE dbo.customers_stage (",
        "    name NVARCHAR(100), email NVARCHAR(150),",
        "    city NVARCHAR(50),  phone VARCHAR(20));",
        "",
        "BULK INSERT dbo.customers_stage FROM '/var/opt/mssql/data/customers.csv'",
        "WITH (FORMAT = 'CSV', FIRSTROW = 2, CODEPAGE = '65001', FIELDQUOTE = '\"');"
      ],
      caption: "The file must be visible to the **server**: `docker cp customers.csv mssql:/var/opt/mssql/data/customers.csv` · CODEPAGE 65001 = UTF-8.",
      notes: "Alternatives: DBeaver/SSMS import wizard, bcp, OPENROWSET(BULK …). The TA-provided customers.csv contains deliberately dirty rows." },

    { type: "bullets", section: "ext", tier: "extended", title: "The staging-table pattern", stepwise: true,
      items: [
        "Load **raw** text into a permissive staging table — nothing enforced",
        "Validate with `TRY_CONVERT` — bad values become NULL, not errors",
        "Insert only the clean rows into the real tables",
        "Keep the raw file for re-runs; drop the stage when done"
      ],
      notes: "This pattern repeats in Session 4 (dirty data), Session 5 (cleaning) and Session 9 (staging for loads). Say that out loud — it is a career-long habit." },

    { type: "challenge", section: "ext", tier: "extended", id: "email-domain", kind: "write",
      title: "Extended: the odd e-mail domain",
      prompt: "Return customers whose e-mail domain is **not** `example.com`. Use `CHARINDEX` + `SUBSTRING`.",
      context: { schema: "shop" },
      thinkMinutes: 3,
      hints: ["CHARINDEX('@', email) gives the split position.", "SUBSTRING(email, at + 1, LEN(email)) is the domain."],
      answer: {
        lang: "sql",
        code: [
          "SELECT name, email",
          "FROM dbo.customers",
          "WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, LEN(email))",
          "      <> 'example.com';"
        ],
        result: { head: ["name", "email"], rows: [] },
        explain: [
          "The split: everything after '@'.",
          "No rows — every seed e-mail uses example.com.",
          "This is where the TA's dirty CSV becomes interesting."
        ],
        pitfalls: "Extended exercise 7 — the real test needs a dirty file. Run it live on customers_stage."
      },
      notes: "Empty result is the correct, verified answer on the seed. Do not invent rows." },

    { type: "challenge", section: "ext", tier: "extended", id: "isnull-truncate", kind: "choose",
      title: "ISNULL vs COALESCE, take two",
      prompt: "What differs between `ISNULL(phone, 'unknown…')` and `COALESCE(phone, 'unknown…')` when `phone` is `VARCHAR(20)` and the replacement is longer?",
      options: [
        "Nothing — both return the full text",
        "`ISNULL` truncates to the first argument's type/length; `COALESCE` does not",
        "`COALESCE` errors on VARCHAR inputs",
        "`ISNULL` upgrades the result to NVARCHAR"
      ],
      correct: 1,
      thinkMinutes: 2,
      answer: {
        text: "**`ISNULL` truncates to 20 characters** — `COALESCE` keeps the full string. Why on the next slide."
      },
      notes: "Extended exercise 10. Great discussion slide: two functions, one silent data-loss surprise. The demo with actual lengths is the next slide." },

    { type: "split", section: "ext", tier: "extended", title: "Why ISNULL truncates",
      left: {
        bullets: [
          "`ISNULL` returns the **type of its first argument** — here `VARCHAR(20)`",
          "Cut to 20 characters: **`unknown phone number`** — silent data loss, no error",
          "ANSI typing: the result type covers **all** arguments — full string survives"
        ]
      },
      right: {
        lang: "sql",
        code: [
          "DECLARE @v VARCHAR(20) = NULL;",
          "SELECT LEN(ISNULL(@v,'unknown phone number!')),",
          "       LEN(COALESCE(@v,'unknown phone number!'));"
        ]
      },
      notes: "21-char replacement: ISNULL returns 20 (the ! is silently cut), COALESCE returns 21. Run it live on SQL Server — SELECT it, not just LEN, to show the actual truncated text." },

    { type: "challenge", section: "ext", tier: "extended", id: "city-report", kind: "design",
      title: "Extended: what are you missing?",
      prompt: "For each **city**: the cheapest and the most expensive product ever ordered by its customers. Write the query — or tell me what you still lack.",
      context: { schema: "shop" },
      thinkMinutes: 4,
      hints: ["Which tables connect a city to a unit price?", "customers → orders → order_items is a chain."],
      answer: {
        lang: "sql",
        code: [
          "SELECT c.city,",
          "       MIN(oi.unit_price) AS cheapest,",
          "       MAX(oi.unit_price) AS most_expensive",
          "FROM dbo.customers c",
          "JOIN dbo.orders      o  ON o.customer_id  = c.customer_id",
          "JOIN dbo.order_items oi ON oi.order_id    = o.order_id",
          "GROUP BY c.city;"
        ],
        explain: [
          "You need **joins** — four tables are chained: customers → orders → order_items (→ products).",
          "This is exactly Session 5's material; today you have only seen single-table aggregates.",
          "Other valid answers exist (subqueries or APPLY) — all of them join somehow."
        ],
        pitfalls: "Extended exercise 11 — attempt it, then compare with Session 5. It is the motivation for next week's joins."
      },
      notes: "Open-ended by design (kind: design). Do not dwell: show the shape of the answer, promise the full treatment in Session 5." },

    /* ============ 8 · Dialect corner & metadata (1:45–1:55) ============ */
    { type: "section", section: "dialect", kicker: "Part 7 · 1:45–1:55",
      title: "Dialect corner & metadata",
      blurb: "Same SQL, three spellings — then look inside the catalog",
      notes: "Fast block. Reveal the compare tables row by row and keep talking — do not read the whole table out loud." },

    { type: "compare", section: "dialect", title: "Dialect corner (1/2)", revealRows: true,
      columns: [
        { key: "mssql", label: "SQL Server", primary: true },
        { key: "pg", label: "PostgreSQL" },
        { key: "my", label: "MySQL" }
      ],
      rows: [
        { label: "First N rows",
          cells: { mssql: "`TOP (n)` / `OFFSET…FETCH`", pg: "`LIMIT n OFFSET m`", my: "`LIMIT n OFFSET m`" } },
        { label: "String concat",
          cells: { mssql: "`+` or `CONCAT` — `NULL + 'a'` is NULL", pg: "`||` — NULL propagates", my: "`CONCAT` — `||` is OR by default!" } },
        { label: "NULL replacement",
          cells: { mssql: "`ISNULL`, `COALESCE`", pg: "`COALESCE`", my: "`IFNULL`, `COALESCE`" } },
        { label: "Identifier quoting",
          cells: { mssql: "`[name]`", pg: "`\"name\"`", my: "\\`name\\`" } },
        { label: "Default text compare",
          cells: { mssql: "case-insensitive", pg: "**case-sensitive**", my: "usually case-insensitive" } }
      ],
      notes: "Session file rows. The MySQL || trap is coming up as a challenge. PostgreSQL being case-sensitive by default surprises everyone coming from SQL Server." },

    { type: "compare", section: "dialect", title: "Dialect corner (2/2)",
      columns: [
        { key: "mssql", label: "SQL Server", primary: true },
        { key: "pg", label: "PostgreSQL" },
        { key: "my", label: "MySQL" }
      ],
      rows: [
        { label: "Case-insensitive match",
          cells: { mssql: "default / `COLLATE`", pg: "`ILIKE`", my: "default" } },
        { label: "Current time",
          cells: { mssql: "`SYSDATETIME()`", pg: "`now()`", my: "`NOW()`" } },
        { label: "Boolean type",
          cells: { mssql: "`BIT`", pg: "`BOOLEAN`", my: "`TINYINT(1)` / `BOOLEAN`" } },
        { label: "Unicode strings",
          cells: { mssql: "`NVARCHAR`, `N'…'`", pg: "`TEXT` is UTF-8", my: "`utf8mb4` charset (not `utf8`!)" } },
        { label: "Batch separator",
          cells: { mssql: "`GO` (client)", pg: "`;`", my: "`;`" } },
        { label: "Rows back from DML",
          cells: { mssql: "`OUTPUT`", pg: "`RETURNING`", my: "none" } },
        { label: "Variable in a script",
          cells: { mssql: "`DECLARE @x INT`", pg: "`\\gset` / PL/pgSQL", my: "`SET @x = 1`" } }
      ],
      caption: "Same question, three answers — knowing the trio is the point of the dialect corners all term.",
      notes: "Do not memorise this: know that it exists and where to look. utf8 in MySQL is really utf8mb3 — a classic production bug." },

    { type: "demo", section: "dialect", title: "Live on all three", switchTo: "3 clients (or DBeaver)", stepwise: true,
      steps: [
        "Top 3 products: `TOP (3)` on SQL Server, `LIMIT 3` on PG and MySQL",
        "Same ORDER BY on all three — same five rows",
        "Concat: run `SELECT 'a' || 'b'` on each engine",
        "Watch MySQL return something else entirely — next challenge"
      ],
      notes: "Have PG and MySQL connected before the block starts. The || demo is the setup for the choose challenge — do not reveal the reason yet." },

    { type: "challenge", section: "dialect", id: "concat-or", kind: "choose",
      title: "Decide: what does MySQL do with ||?",
      prompt: "PostgreSQL and SQL Server (with CONCAT) treat `||` as string concatenation. You run `SELECT 'a' || 'b';` on MySQL 8. What happens?",
      options: [
        "It concatenates, same as PostgreSQL: `ab`",
        "It is the logical OR operator — you get a 0 or 1 result",
        "Syntax error: unexpected token",
        "It concatenates, but with a warning"
      ],
      correct: 1,
      thinkMinutes: 2,
      hints: ["The dialect table showed MySQL's default operator set.", "Strings convert to numbers: 'a' becomes 0."],
      answer: {
        text: "MySQL treats **`||` as logical OR** by default. `'a' || 'b'` compares two non-numeric strings converted to numbers (0 and 0) → the boolean result — not `ab`.",
        explain: [
          "Concatenation in MySQL: `CONCAT(a, b)`.",
          "PostgreSQL keeps `||` for concat; MySQL changed what its dialect table calls 'OR by default'."
        ],
        pitfalls: "Run it live and show the actual value on the version you teach with — never trust a slide over the engine in front of you."
      },
      notes: "Dialect table row: MySQL CONCAT (|| is OR by default!). Verified by reasoning from the session file — the live demo is the machine check." },

    { type: "code", section: "dialect", title: "Ask the catalog", lang: "sql",
      code: [
        "SELECT TABLE_SCHEMA, TABLE_NAME",
        "FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';",
        "",
        "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE",
        "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers';",
        "",
        "EXEC sp_help 'dbo.customers';"
      ],
      caption: "`INFORMATION_SCHEMA` is ANSI — it works in PostgreSQL and MySQL too. `sys.*` catalog views are richer but SQL Server-only.",
      notes: "Useful for the project: generate your schema documentation from these two queries. DB_NAME(), SCHEMA_NAME(), @@VERSION round it out." },

    { type: "challenge", section: "dialect", id: "join-teaser", kind: "predict",
      title: "Teaser: who is missing?",
      prompt: "There are 8 customers and 14 orders. How many **customers** appear in this result — and who is missing?",
      context: {
        lang: "sql",
        code: [
          "SELECT c.name, o.order_id, o.order_date",
          "FROM dbo.customers c",
          "JOIN dbo.orders o ON o.customer_id = c.customer_id",
          "ORDER BY c.name, o.order_date;"
        ]
      },
      thinkMinutes: 2,
      hints: ["Which customer_id values appear in dbo.orders?", "customer_id 7 and 8 …"],
      answer: {
        text: "**6 of 8 customers.** Arash Naderi and Leila Farhadi never ordered — the inner join drops them (and their rows).",
        explain: [
          "An inner join keeps only matching pairs.",
          "Customers with zero orders survive only in an OUTER join — Session 5.",
          "The result itself has 14 rows: one per order."
        ],
        pitfalls: "The same trap silently hides missing parents in every reporting query you will ever write."
      },
      notes: "Ask why, not what. Answers 'because JOIN' or 'only customers with orders' are both good. Formal join treatment: Session 5." },

    /* ============ 9 · Wrap-up (1:55–2:00) ============ */
    { type: "recap", section: "homework", kicker: "Wrap-up",
      title: "Today in one screen",
      items: [
        "Docker + client + `shop_seed_tsql.sql` = your workstation for the term",
        "`GO` is a client command; variables die with their batch",
        "Logical order explains aliases and NULL surprises",
        "`TOP` / `OFFSET…FETCH`, `GROUP BY` + `HAVING`",
        "`N'…'` literals, `LEN` vs `DATALENGTH`, `TRY_CONVERT`",
        "Safe DML: `BEGIN TRAN` → check → `COMMIT`/`ROLLBACK`, with `OUTPUT`"
      ],
      notes: "Two minutes max — the exit quiz does the real recall work. Point at the diagram slide when you say logical order." },

    { type: "quiz", section: "homework", kicker: "Exit quiz", title: "Exit quiz · 1/5",
      question: "What does `WHERE phone <> '0912'` do with rows where `phone IS NULL`?",
      options: [
        "They are returned with a NULL phone",
        "They are not returned — the comparison is UNKNOWN",
        "They are returned last",
        "SQL Server raises an error"
      ],
      correct: 1,
      explain: "NULL <> '0912' is UNKNOWN, and `WHERE` keeps only TRUE. Use `IS NULL` or `IS NOT NULL` to target NULL rows deliberately.",
      notes: "Answers from the session file. If the room hesitates, re-ask: 'is UNKNOWN true?'" },

    { type: "quiz", section: "homework", kicker: "Exit quiz", title: "Exit quiz · 2/5",
      question: "What are `SELECT 7/2`, `SELECT 7/2.0`, and `SELECT 7 % 2`?",
      options: ["3, 3.5, 1", "3.5, 3.5, 1", "3, 3, 1", "2, 3.5, 1"],
      correct: 0,
      explain: "Integer ÷ integer stays integer (3). One decimal operand makes the result decimal (3.5). `7 % 2` is the remainder: 1.",
      notes: "Same as the session file's answer. SQL Server may display the decimal with a wider scale — same value." },

    { type: "quiz", section: "homework", kicker: "Exit quiz", title: "Exit quiz · 3/5",
      question: "Why is a SELECT alias unusable in `WHERE` but usable in `ORDER BY`?",
      options: [
        "`WHERE` runs after `SELECT`",
        "`WHERE` is evaluated before `SELECT`; `ORDER BY` after",
        "Aliases are banned in every clause",
        "Only MySQL allows aliases in `WHERE`"
      ],
      correct: 1,
      explain: "Logical order: FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY. The alias is created at the SELECT step.",
      notes: "They saw this as the spot-the-bug challenge — expect near-full marks." },

    { type: "quiz", section: "homework", kicker: "Exit quiz", title: "Exit quiz · 4/5",
      question: "`LEN(N'سروش')` vs `DATALENGTH(N'سروش')` — characters or bytes?",
      options: [
        "4 characters vs 8 bytes",
        "8 characters vs 8 bytes",
        "4 characters vs 4 bytes",
        "It depends on the collation"
      ],
      correct: 0,
      explain: "`N'سروش'` has 4 characters; `NVARCHAR` stores 2 bytes per character, so `DATALENGTH` = 8 bytes.",
      notes: "dir=auto renders the Persian correctly. Mention VARCHAR would store 1 byte per char — and mangle the text." },

    { type: "quiz", section: "homework", kicker: "Exit quiz", title: "Exit quiz · 5/5",
      question: "Is `GO` part of T-SQL?",
      options: [
        "Yes — it ends a T-SQL statement",
        "No — it is a batch separator understood by client tools",
        "Only inside stored procedures",
        "Yes, but only in sqlcmd"
      ],
      correct: 1,
      explain: "SSMS and `sqlcmd` split batches at `GO`; the server never sees it. That is why variables do not survive it.",
      notes: "Ties back to the first challenge of the basics block." },

    { type: "homework", section: "homework", kicker: "Wrap-up",
      title: "Homework",
      items: [
        "Solve the **12 query tasks** on ShopDB — on SQL Server",
        "For 3 of them, also write the PostgreSQL or MySQL version",
        "Note exactly what had to change between dialects",
        "Read: logical query processing (Microsoft docs)",
        "Prepare **one** question for Session 2"
      ],
      due: "before Session 2",
      notes: "Hand out / link the task sheet now. The three dialect tasks deliberately include a LIMIT vs TOP question. Extended exercises 7-11 live in the session file." },

    { type: "end", section: "homework",
      title: "Questions?",
      next: "Session 2 — Keys, constraints & relationships",
      notes: "Remind: docker images stay up between sessions; run `docker compose down` at home if the laptop cooks. See you next week." }
  ]
};
