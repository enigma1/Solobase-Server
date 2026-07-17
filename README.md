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
git clone <Solobase-Server>
cd <Solobase-Server> folder
npm i
cp .env.template .env

#### Configuration
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


When **COOKIE_USE_DOMAIN=0** (default), **Solobase-Server** removes the **Domain** parameter from *Set-Cookie* headers thus allowing the browser to create host-only cookies. Set it to 1 to allow the parameter to pass through the proxy from the upstream host.

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

## 🧾 License
GNU General Public License (GPL) v3
