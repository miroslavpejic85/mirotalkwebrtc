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
