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
For *development* use
```
npm run dev
```
otherwise for *production*
```
npm run build
npm run start
```
Output files will be generated under the *dist* folder


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
