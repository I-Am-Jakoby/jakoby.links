# Deploy with Cyclic.sh

1. Fork this repo
1. Sign up with [Cyclic.sh](https://www.cyclic.sh/) & grant access to your fork
1. Navigate to https://app.cyclic.sh/
1. Create a deployment for your fork.
1. Click the `🔧` wrench icon for your fork deployment 
1. Click the `Data/Storage` tab, and copy the `Table Name` from the `AWS DynamoDB` section
1. Click the `Variables` tab
1. Add a new variable named `WEBSITE` and enter your website as the value. (eg: `https://host/`)
1. Add a new variable named `PASSWORD` and enter some secret password you will use to list/delete redirects.
1. Add a new variable named `CYCLIC_DB` and paste the `Table Name` value you copied in a previous step.
