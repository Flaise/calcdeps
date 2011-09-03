#!/usr/bin/env node

var calcdeps = require('../lib/calcdeps'),
    async = require('async'),
    fs = require('fs'),
    optimist = require('optimist'),
    argv = optimist
      .usage('usage: $0 [options] arg')
      .wrap(80)
      .options('i', {
        alias: 'input',
        description: 'The inputs to calculate dependencies for. Valid values can be files or directories.'
      })
      .options('p', {
        alias: 'path',
        default: ['.'],
        description: 'The paths that should be traversed to build the dependencies.'
      })
      .options('d', {
        alias: 'dep',
        default: [],
        description: 'Directories or files that should be traversed to find required dependencies for the deps file. Does not generate dependency information for names provided by these files.'
      })
      .options('e', {
        alias: 'exclude',
        default: [],
        description: 'Files or directories to exclude from the --path and --input flags.'
      })
      .options('o', {
        alias: 'output_mode',
        default: 'list',
        description: 'The type of output to generate from this script. Options are "list" for a list of filenames, "script" for a single script containing the contents of all the files, or "deps" to generate a deps.js file for all paths'
      })
      .options('output_file', {
        description: 'If specified, write output to this path instead of writing to standard output.'
      })
      .options('h', {
        alias: 'help',
        boolean: true
      })
      .argv;

if (argv.help) {
  optimist.showHelp();
} else {
  var options = {},
      outputFile = argv.output_file;

  if (!['list', 'script', 'deps'].some(function (v) { return v === argv.output_mode; })) {
    options.output_mode = 'list';
  } else {
    options.output_mode = argv.output_mode;
  }

  ['input', 'path', 'dep', 'exclude'].forEach(function (name) {
    if (argv[name] && typeof argv[name] === 'string') {
      options[name] = [argv[name]];
    } else if (argv[name] && Array.isArray(argv[name])) {
      options[name] = argv[name];
    } else {
      options[name] = [];
    }
  });

  calcdeps(options, function (err, results) {
    var outputStream = null;
    if (err) {
      console.error(err);
    } else {
      if (outputFile) {
        outputStream = fs.createWriteStream(outputFile);
      } else {
        outputStream = process.stdout;
      }

      if (options.output_mode === 'deps') {
        outputStream.write('// This file was autogenerated by calcdeps.js\n');
        results.forEach(function (result) {
            outputStream.write('goog.addDependency("' + result.relativePath + '", ' + JSON.stringify(result.provide) + ', ' + JSON.stringify(result.require) + ');\n');
        });
        outputStream.end();
      } else if (options.output_mode === 'list') {
        results.forEach(function (result) {
          outputStream.write(result + '\n');
        });
        outputStream.end();
      } else if (options.output_mode === 'script') {
        var i = 0;
        async.forEachSeries(results, function (result, callback) {
          var readStream = fs.createReadStream(result, { flags: 'r' });
          outputStream.write('// Input ' + i + '\n');
          i += 1;
          readStream.pipe(outputStream, { end: false });
          readStream.on('end', callback);
        }, function (err) {
          if (err) {
            console.error(err);
          } else {
            outputStream.end();
          }
        });
      }
    }
  });
}
