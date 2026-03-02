<h1 align='center'>
    <img 
        src='/assets/logo.png' 
        height='200' 
        width='200'
        alt='Logo' 
    />
    <br>
    Seerr Notifier
    <br>
</h1>

<div align='center'>
    <a href='https://github.com/jbakalarski/SeerrNotifier'>
        <img src='https://img.shields.io/github/stars/jbakalarski/SeerrNotifier?style=for-the-badge&color=%23cfb002'/>
    </a>
    <a href='https://hub.docker.com/r/jedrzejme/seerr-notifier'>
        <img src='https://img.shields.io/docker/pulls/jedrzejme/seerr-notifier?style=for-the-badge&label=DOCKER%20PULLS'/>
    </a>
    <a href='https://github.com/jbakalarski/SeerrNotifier/tags'>
        <img src='https://img.shields.io/github/v/tag/jbakalarski/SeerrNotifier?sort=date&style=for-the-badge&label=VERSION&color=%23db34eb'/>
    </a>
    <a href='https://github.com/jbakalarski/SeerrNotifier/issues'>
        <img src='https://img.shields.io/github/issues/jbakalarski/SeerrNotifier?style=for-the-badge&color=%23ff6f00'/>
    </a>
    <a href='https://github.com/jbakalarski/SeerrNotifier/pulls'>
        <img src='https://img.shields.io/github/issues-pr/jbakalarski/SeerrNotifier?style=for-the-badge'/>
    </a>
</div>

<br>

**❓ What is this?** Seerr Notifier is a service that receives notifications from [Seerr](https://github.com/seerr-team/seerr) and instantly sends a [Messenger](https://www.messenger.com/) alert when a requested movie or series becomes available.

**❓ How to use it?**
* [**Using Cloudflare Workers**](#%EF%B8%8F-using-cloudflare-workers-to-run-seerr-notifier)
* [**Using docker-compose**](#-using-docker-compose-to-run-seerr-notifier)

**❓ What did I use?**
* JavaScript
* [Cloudflare Workers](https://workers.cloudflare.com/)
* [Docker](https://www.docker.com/)
* [Seerr Notifications](https://docs.seerr.dev/using-seerr/notifications/webhook)
* [CallMeBot](https://www.callmebot.com/)
* [Coding](https://code.visualstudio.com/)
* [Git management](https://desktop.github.com/)

## ☁️ Using Cloudflare Workers to run Seerr Notifier
1) Use this repository as a template (make sure it's private)
2) Edit `wrangler.jsonc` according to [Environment variables](#%EF%B8%8F-environment-variables)
3) Deploy a new Worker in Cloudflare from template of this repository with edited `wrangler.jsonc`
4) Grab the `workers.dev` URL from the `Settings` tab
5) Put it in `Notifcations` settings in `Webhook` in Seerr and also `Authorization Header` from `wrangler.jsonc`
6) Enable `Request Available` in `Notification Types`
7) Save

## 🐳 Using docker-compose to run Seerr Notifier
1) Copy `docker-compose.yml` and `wrangler.jsonc` to directory of your choice
2) Edit `wrangler.jsonc` according to [Environment variables](#%EF%B8%8F-environment-variables)
3) Run container - `docker-compose up -d`
4) Grab the `IP:PORT` of your container
5) Put it in `Notifcations` settings in `Webhook` in Seerr and also `Authorization Header` from `wrangler.jsonc`
6) Enable `Request Available` in `Notification Types`
7) Save

## 🛠️ Environment variables
* `SECRET_TOKEN` - random strong string (used as Authorization Header)
* `LANG` - language of sent notications (choose one from templates or [create your own](#-creating-your-own-template))
* `SEND_IMAGES` - `true` or `false`, enables or disables sending requested media poster
* `CALLMEBOT_KEYS_{user}` - API key from CallMeBot for specific Seerr user - [tutorial on getting CallMeBot API key](https://www.callmebot.com/blog/free-api-facebook-messenger/), you can put multpile keys for one user sperated by space

**Sample config of `vars`:**
```json
  "vars": {
    "SECRET_TOKEN": "EjtL4qHPAsiwGXgTmyyZGlE47ybv1wp8",
    "LANG": "pl",
    "SEND_IMAGES": "true",
    "CALLMEBOT_KEYS_bob": "CbIRCfJy zaZwyvdj",
    "CALLMEBOT_KEYS_alice": "XCJxndvb"
  }
```

## 🎨 Creating your own template
To create your own template you need to create new file in `templates` directory.<br>
While creating template you can use following template syntax:<br>
`{{subject}}` - title of requested media<br>
`{{season}}` - season number (e.g. `01`, `03`, `10`)<br>
`{{season_number}}` - raw season number (e.g. `3`)<br>
`{{if media_media_type == "movie"}}...{{endif}}` - conditional block, content inside will be included only if the media type is a movie<br>
`{{if media_media_type == "tv"}}...{{endif}}` - conditional block, content inside will be included only if the media type is a TV series<br>
`{{seasons}}` - array of zero-padded season strings when multiple seasons requested (e.g. [`01`,`02`])<br>
`{{seasons_numbers}}` - array of raw season numbers as strings (e.g. [`1`,`2`])<br>
`{{seasons_count}}` - number of requested seasons<br>
`{{multiple_seasons}}` - boolean, true when more than one season was requested<br>
`{{for season in seasons}}...{{endfor}}` - loop over requested seasons; inside the loop `{{season}}` is the padded season and `{{season_number}}` is the raw number<br>
`{{if multiple_seasons}}...{{endif}}` - conditional block that runs only when multiple seasons were requested

## 🚀 Features
* 🔔 Receives notifications from Seerr when a requested movie or series becomes available
* 💬 Sends instant alerts to Messenger via CallMeBot
* 🎯 Only notifies when media status is "available"
* 🌐 Supports multiple users with individual CallMeBot keys
* 📝 Customizable message templates per language
* ⚡ Fast, serverless, no database required
* 🖥️ Clean logging and debugging output in console
* 🔐 Secured with a secret token (no public access)

## 💡 To-Do
* [ ] Add support for sending notifications through Signal, WhatsApp and Telegram
  
## 💲 Support
<p><a href="https://support.jedrzej.me/" target="_blank"> <img align="left" src="https://raw.githubusercontent.com/jbakalarski/jbakalarski/main/assets/supportme.png" width="172" height="56" alt="jbakalarski" /></a></p>