# Deploy with Cyclic.sh

1. Fork this repo
1. Sign up with [Cyclic.sh](https://www.cyclic.sh/)
1. Navigate to https://app.cyclic.sh/
1. Deploy a new app.
1. Click the "Link Your Own" tab.
1. Select & grant access to your fork
1. Click the `🔧` wrench icon for your fork deployment
1. Click the `Variables` tab
1. Add a new variable named `WEBSITE` and enter your website as the value. (eg: `https://host/`)
1. Add a new variable named `PASSWORD` and enter some secret password you will use to list/delete redirects. (eg: `this is a password`)
1. Add a new variable named `DEPLOYMENT` and enter the url where you intent to deploy the application __WITH NO TRAILING SLASH__. (eg: `https://host`)

# Scripts

## Delete 301 Webhooks

Less experienced users are keen to paste a whole shitload of webhooks with a 301 status, not realizing that most webhooks only support POST operations, while 301 redirects do not.

To help educate, and also get rid of all this extra crap, the `./scripts/delete_301_webhooks.js` script will delete redirects that look like webhooks, but don't use a `307` status code.

For webhooks that look like discord webhooks (99% of them), it also sends a friendly message.

### Running
```bash
export DEPLOYMENT=https://link.iamjakoby.com;
export PASSWORD=password;
./scripts/delete_301_webhooks.js;
```
