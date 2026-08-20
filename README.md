# Solobase-Server

Solobase backend service targets MySQL database operations, schema management, exports and client communication.

The **Solobase-Server** is a lightweight backend service based on Fastify designed for MySQL data management. Connects via session and utilizes both xDevAPI and mysql2 connections.

## Support This Project

If you find this extension useful, you can support development via PayPal:
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate?hosted_button_id=CRPY96XAY793A)
Thank you for helping keep this project maintained and improving!
written by: Mark Samios [@enigma1](https://github.com/enigma1)

## Features

#### Database Management

- Connect and manage MySQL database sessions
- Browse available databases
- Select active databases for management operations
- Create, modify, and delete databases
- Retrieve database metadata and information
-

#### Database Tables Management

- Browse database tables
- View table definitions and metadata
- Inspect table columns, types, constraints, and indexes
- Create new tables
- Modify existing table structures
- Delete tables

#### Data Management

- Browse table data with row fetching
- Create, update, and delete data rows
- Execute raw SQL queries
- Stream query results
- Abort running SQL operations

#### User Management

- View database users
- Create users
- Edit user configuration
- Delete users

#### Import and Export

- Export complete databases as SQL archives
- Export selected tables with schema and data
- Import SQL data
- Stream large exports using compressed responses

#### Authentication and Sessions

- Session-based authentication
- Secure cookie handling
- Session validation
- Login/logout management
- Automatic session cleanup

#### API Features

- Fastify-based HTTP API
- JSON API responses
- Streaming responses for large operations
- Request validation using schemas
- Structured error handling
- SQL query tracking and diagnostics

#### AI Integration

The backend provides an LLM-powered SQL assistant for generating MySQL queries from natural-language requests.

The AI integration is designed around the existing application architecture: the LLM does not execute SQL or access database results directly. Instead, it generates a structured application-level request that is returned to the frontend, which then performs the requested operation through the normal application API and state-management flow.

Verified: Ollama and Google Gemini have been tested end-to-end. OpenAI and Anthropic are supported through LangChain's initChatModel, but have not been end-to-end tested because their API currently requires prepaid credits.

##### OpenRouter models

The SQL assistant can also use models available through [OpenRouter](https://openrouter.ai/).
OpenRouter provides access to models from multiple providers through a common OpenAI-compatible API. You can see a full list of models from the from the interface on the front end (Server -> Get Open Router Models).

Assistant Features include:

- **Natural-language SQL generation** — Users can describe database operations in plain language and the assistant generates the corresponding MySQL SQL.
- **Structured output** — LLM responses are validated against a Zod schema before being passed to the application.
- **Incomplete request handling** — When a request cannot be completed from the available information, the assistant identifies the missing information and generates clarification questions.
- **Query scope detection** — Requests are classified as either:
  - `current` — a new SQL request based on the current user message.
  - `thread` — a request referring to SQL queries or context from earlier messages in the conversation.
- **Conversation-aware requests** — Thread-level requests can use the conversation history to answer questions about previously generated SQL.
- **SQL history integration** — Previously generated queries are retained as part of the conversation/application context, allowing users to refer back to earlier SQL requests.
- **Provider-independent LLM support** — The AI layer can use different LLM providers through LangChain, including local Ollama models and hosted providers such as OpenAI, Anthropic, and Google Gemini.
- **Configurable model selection** — The active model is selected through application configuration rather than being hard-coded into the SQL assistant.
- **Provider-specific configuration** — Local models such as Ollama can use provider-specific options while hosted models are initialized through LangChain's model abstraction.
- **AI availability monitoring** — The backend periodically checks the configured AI provider's health endpoint without consuming model tokens. The frontend uses this status to determine whether the AI functionality should be available.
- **No direct SQL execution by the LLM** — Generated SQL is treated as an application request and is executed only through the application's existing database architecture.
- **Existing security and validation boundaries are preserved** — The AI assistant does not bypass the application's authentication, database API, validation, or state-management mechanisms.
- **LangGraph workflow** — The assistant is implemented as a LangGraph workflow, allowing the SQL-generation process to be extended with additional decision or processing nodes as the AI functionality evolves.

#### Typical deployment

Browser -> Optional Local Proxy -> **Solobase-Server**

#### Environment

- Tested on node v20-22
- Tested on npm v10-11

#### Installation

```bash
mkdir <Solobase-Server> folder
cd <Solobase-Server> folder
git clone https://github.com/enigma1/Solobase-Server.git .
npm i
cp .env.template .env
```

#### Configuration

**Solobase-Server** is configured through the `.env` file. The default values are suitable for a local installation, but you should review them before deployment.

##### Frontend

Configure the frontend host and origin used by **Solobase-Server**.

```batch
FRONTEND_HOST=127.0.0.1
FRONTEND_ORIGIN=https://127.0.0.1:5173
```

**FRONTEND_ORIGIN** is used for CORS configuration.
**FRONTEND_HOST** is used when cookie domains are enabled.

When **COOKIE_USE_DOMAIN=1**, the server adds the `Domain` attribute to session cookies using this value.

When **COOKIE_USE_DOMAIN=0** (default), the `Domain` attribute is omitted, creating a host-only cookie. This is usually preferred because the browser automatically associates the cookie with the host that issued it.

```batch
COOKIE_USE_DOMAIN=0
```

For installations where the frontend and backend are served from the same hostname, host-only cookies are recommended.

When **REFLECT_ORIGIN=1** (default), **Solobase-Server** reflects the incoming `Origin` header in the `Access-Control-Allow-Origin` response header.

When **REFLECT_ORIGIN=0**, the server uses the configured **FRONTEND_ORIGIN** value instead.

```batch
REFLECT_ORIGIN=1
```

You can modify the .env file for SSL or NON-SSL modes.
If **SSL_ENABLED=1** (default), the proxy requires a private key and certificate.

To create a certificate...

```batch
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout server.key \
  -out server.crt \
  -days 1825
```

Configure the following variables:

```batch
TLS_KEY=/path/to/server.key
TLS_CERT=/path/to/server.crt
```

When **SSL_ENABLED=0**, **Solobase-Server** runs over plain HTTP and the TLS variables are ignored.

#### Preferences

Preferences for each user are stored in the directory specified by:

```batch
PREFERENCES_DIR=prefs
```

Optionally, provide an **ENCODING_KEY** to obfuscate preference filenames on disk.

##### MySQL Connections

The proxy uses two MySQL connections:

- **MySQL Protocol** (`3306`) for standard SQL operations.
- **MySQL X Protocol** (`33060`) for Document Store operations.

##### Database Connections

Configure the MySQL server used by **Solobase-Server**.

The standard MySQL protocol is used for SQL operations:

```batch
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
```

The MySQL X Protocol used:

```batch
DB_XHOST=127.0.0.1
DB_XPORT=33060
DB_XUSER=root
DB_XPASSWORD=
```

#### AI Configuration

The AI assistant is configured through the application's `.env` file. The backend supports multiple LLM providers and the active model is selected using the `AI_MODEL` setting.

API keys are only required for hosted providers. Local Ollama models do not require an API key.

```batch
# AI provider API keys

ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key

# Active AI model

AI_MODEL=ollama:qwen3.5:9b
```

Note: Model names and availability depend on the configured provider. Hosted providers may require an appropriate API key, account access, and model availability. Some of the Ollama models are free can be installed locally.

##### Application Database User

These credentials are used internally by **Solobase-Server** for storing metadata and preferences on another database server. Currently settings are saved in files. To be completed.

```batch
DB_APP_HOST=127.0.0.2
DB_APP_PORT=3306
DB_APP_USER=appUser
DB_APP_PASSWORD=

DB_APP_XHOST=127.0.0.2
DB_APP_XPORT=33061
DB_APP_XUSER=appUser
DB_APP_XPASSWORD=
```

#### Operation

For _development_ use

```
npm run dev
```

otherwise for _production_

```
npm run build
npm run start
```

Output files will be generated under the _dist_ folder

##### External Frontend Deployment

If the Solobase frontend SPA is deployed separately from **Solobase-Server** (for example, hosted on another machine or served from a different origin), an additional proxy component can be used to handle the frontend-to-server connection.

The optional proxy component is available here:
https://github.com/enigma1/Solobase-Proxy-Agent

When the frontend and **Solobase-Server** are deployed together on the same host and origin, the proxy is not required.

##### Advanced Settings

Additional server settings are available in the configuration file:

```
src/config/envConfig.ts
```

These options control internal server behavior such as timeouts, session cleanup intervals, and database connection settings. Modify them only when you need behavior different from the defaults.

## 🧾 License

GNU General Public License (GPL) v3
