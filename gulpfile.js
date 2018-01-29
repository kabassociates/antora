'use strict'

const gulp = require('gulp')
const opts = require('yargs-parser')(process.argv.slice(2))

const lint = require('./tasks/lint-task')
const format = require('./tasks/format-task')
const test = require('./tasks/test-task')
const commitlint = require('./tasks/commitlint-task')

const allFiles = opts.package
  ? [`packages/${opts.package}/{lib,test}/**/*.js`]
  : ['gulpfile.js', '{lib*,scripts,tasks,test}/**/*.js', 'packages/*/{lib,test}/**/*.js']
const testFiles = opts.package
  ? [`packages/${opts.package}/test/**/*-test.js`]
  : ['test/**/*-test.js', 'packages/*/test/**/*-test.js']

const isCodeCoverageEnabled = () => process.env.COVERAGE === 'true' || process.env.CI

gulp.task('lint', () => lint(allFiles))
gulp.task('format', () => format(allFiles))
gulp.task('test', ['lint'], () => test(testFiles, isCodeCoverageEnabled()))
gulp.task('test!', () => test(testFiles, isCodeCoverageEnabled()))
gulp.task('test:watch', () => gulp.watch(allFiles, ['test!']))
gulp.task('commitlint', () => commitlint())

gulp.task('default', ['test'])
