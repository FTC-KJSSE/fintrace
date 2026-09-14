# FinTrace Offline Geolocation Data

FinTrace supports **100% offline, zero-network IP geolocation** using MaxMind-compatible binary databases (`.mmdb` format).

When a valid `.mmdb` database file is placed in this directory or configured via `FINTRACE_MMDB_PATH`, FinTrace will:
1. Load the database locally into memory on startup.
2. Resolve intermediate traceroute IP addresses in **<0.05 milliseconds** per hop.
3. Transmit **zero IP addresses** over the external internet (100% private).
4. Bypass all external API rate limits and throttling queues.

---

## Recommended Free & Redistributable Database: DB-IP Lite

FinTrace recommends the **DB-IP City Lite** or **DB-IP Country Lite** database.

* **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
* **Commercial & Redistribution Use:** Permitted under CC BY 4.0 with attribution.
* **Download:** [https://db-ip.com/db/download/ip-to-city-lite](https://db-ip.com/db/download/ip-to-city-lite) or [https://db-ip.com/db/download/ip-to-country-lite](https://db-ip.com/db/download/ip-to-country-lite)

### File Placement:
Place the downloaded `.mmdb` file in:
```
backend/data/dbip-city-lite.mmdb
```
or
```
backend/data/dbip-country-lite.mmdb
```

---

## Alternative Databases: MaxMind GeoLite2

You may also use your own downloaded copy of **MaxMind GeoLite2 City** (`GeoLite2-City.mmdb`).
* Note: MaxMind GeoLite2 requires user registration on MaxMind.com and is governed by the MaxMind GeoLite2 EULA.

---

## Mandatory Attribution Notice

> **IP Geolocation by DB-IP**  
> This product uses DB-IP Lite IP geolocation data under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).  
> Available at: [https://db-ip.com](https://db-ip.com)
