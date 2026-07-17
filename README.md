# Solobase-Proxy-Agent
A configurable reverse proxy that forwards API requests from browser front ends to remote back-end services.

## Main Features
- Proxies HTTP/HTTPS requests to a backend.
- Rewrites response headers (hosts, ports).
- Can rewrite Set-Cookie headers.
- Supports HTTP and HTTPS.
- Can be configured through environment variables.

The **Solobase-Proxy-Agent** a lightweight reverse proxy designed for browser-based applications. It forwards requests to a configurable backend and can rewrite response headers and cookies. It is useful when browsers cannot communicate directly with a backend because of deployment topology, host name differences or networking constraints.

#### Typical deployment
Browser -> **Solobase-Proxy-Agent** -> Backend Host

## Support This Project
If you find this extension useful, you can support development via PayPal:
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate?hosted_button_id=CRPY96XAY793A)
Thank you for helping keep this project maintained and improving!
written by: Mark Samios [@enigma1](https://github.com/enigma1)

#### Environment
- Tested on node v20-22
- Tested on npm v10-11

#### Installation
git clone <Solobase-Proxy-Agent>
cd <Solobase-Proxy-Agent> folder
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

When **SSL_ENABLED=0**, **Solobase-Proxy-Agent** runs over plain HTTP and the TLS variables are ignored.


When **COOKIE_USE_DOMAIN=0** (default), **Solobase-Proxy-Agent** removes the **Domain** parameter from *Set-Cookie* headers thus allowing the browser to create host-only cookies. Set it to 1 to allow the parameter to pass through the proxy from the upstream host.

For local installations where the backend uses a self-signed certificate, set **NODE_TLS_REJECT_UNAUTHORIZED=0**. For environments using certificates issued by a trusted CA, leave verification enabled (1 is Default).

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
