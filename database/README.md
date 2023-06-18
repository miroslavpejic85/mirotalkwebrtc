# MongoDB migrations

![mongo](./mongodb.png)

`NPM`: https://www.npmjs.com/package/migrate-mongo

## Installation

```bash
$ npm install -g migrate-mongo
```

## CLI Usage

```bash
$ migrate-mongo
Usage: migrate-mongo [options] [command]


  Commands:

    init                  initialize a new migration project
    create [description]  create a new database migration with the provided description
    up [options]          run all unapplied database migrations
    down [options]        undo the last applied database migration
    status [options]      print the changelog of the database

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

## Config

Copy the `migrate-mongo-config-template.js` to `migrate-mongo-config.js` and Change (or review) the `config` acording to your MongoDB.

```js
const config = {
    mongodb: {
        // TODO Change (or review) the url to your MongoDB (.env MONGO_URL):
        url: 'mongodb://localhost:27017',

        // TODO Change this to your database name (.env MONGO_DATABASE):
        databaseName: 'mirotalk',

        options: {
            useNewUrlParser: true, // removes a deprecation warning when connecting
            useUnifiedTopology: true, // removes a deprecating warning when connecting
            // connectTimeoutMS: 3600000,   // increase connection timeout to 1 hour
            // socketTimeoutMS: 3600000,    // increase socket timeout to 1 hour
        },
    },

    // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
    migrationsDir: 'migrations',

    // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
    changelogCollectionName: 'changelog',

    // The file extension to create migrations and search for in migration dir
    migrationFileExtension: '.js',

    // Enable the algorithm to create a checksum of the file contents and use that in the comparison to determine
    // if the file should be run.  Requires that scripts are coded to be run multiple times.
    useFileHash: false,

    // Don't change this, unless you know what you're doing
    moduleSystem: 'commonjs',
};

module.exports = config;
```
