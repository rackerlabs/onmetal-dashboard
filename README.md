ironic-dashboard
==============
Dashboard for monitoring Ironic nodes.

Prerequisite
==============
You need:
* Node JS & NPM
* Gulp `sudo npm install -g gulp`

Getting Started
==============

1. `npm install`
2. `cp config.sample.js config.js` edit as needed.  The options in config.sample.js are defaults and will be merged into config.js on load (config.js will overwrite if there is a conflict).  Confidential data should be kept in config.js.
3. `npm start` or `bin/www`

Contributing
==============

Run your code through JSLint. It is okay to ignore `unused param` warnings. Please follow all other warnings/errors.

* 2 space indentations.
* Single quotes are preferred over double quotes.
* No hard column limit, try to keep it under 120 chars. Use your best judgement.
* Dot notation (`obj.key1`) is preferred over array access (`obj['key1']`) unless the key is a variable (`obj[key_name]`).
* Having space between blocks of code is nice. For an example of this, see [`summary.js @ getBarChartObject`](https://github.com/rackerlabs/ironic-dashboard/blob/895786b70d0881a3eed742ff18f03a06238fbcef/routes/summary.js#L53).

To concatenate and minify the JS and CSS, simply run:

    gulp

Which is a shortcut for:
    
    gulp js && gulp css

FIXME
==============
Take a gander at the [issues](https://github.com/rackerlabs/ironic-dashboard/issues?state=open) page.

