/* eslint-env mocha */
'use strict'

const { expect } = require('../../../test/test-utils')

const cheerio = require('cheerio')
const fs = require('fs-extra')
const generateSite = require('@antora/site-generator-default')
const ospath = require('path')
const RepositoryBuilder = require('../../../test/repository-builder')

const CONTENT_REPOS_DIR = ospath.join(__dirname, 'content-repos')
const CWD = process.cwd()
const FIXTURES_DIR = ospath.join(__dirname, 'fixtures')
const WORK_DIR = ospath.join(__dirname, 'work')
const TIMEOUT = 5000
const UI_BUNDLE_URI =
  'https://gitlab.com/antora/antora-ui-default/-/jobs/artifacts/master/raw/build/ui-bundle.zip?job=bundle-stable'

describe('generateSite()', () => {
  let $
  let destDir
  let playbookSpec
  let playbookSpecFile
  let repositoryBuilder
  let uiBundleUri

  const readFile = (file, dir) => fs.readFileSync(dir ? ospath.join(dir, file) : file, 'utf8')

  const loadHtmlFile = (relative) => cheerio.load(readFile(relative, destDir))

  before(async () => {
    destDir = '_site'
    playbookSpecFile = ospath.join(WORK_DIR, 'the-site.json')
    repositoryBuilder = new RepositoryBuilder(CONTENT_REPOS_DIR, FIXTURES_DIR)
    uiBundleUri = UI_BUNDLE_URI
  })

  beforeEach(async () => {
    fs.removeSync(CONTENT_REPOS_DIR)
    await repositoryBuilder
      .init('the-component')
      .then(() => repositoryBuilder.checkoutBranch('v2.0'))
      .then(() =>
        repositoryBuilder.addComponentDescriptorToWorktree({
          name: 'the-component',
          version: '2.0',
          nav: ['modules/ROOT/nav.adoc'],
        })
      )
      .then(() => repositoryBuilder.importFilesFromFixture('the-component'))
      .then(() => repositoryBuilder.close('master'))
    playbookSpec = {
      site: { title: 'The Site' },
      content: {
        sources: [{ url: ospath.join(CONTENT_REPOS_DIR, 'the-component'), branches: 'v2.0' }],
      },
      ui: { bundle: uiBundleUri },
      output: {
        destinations: [{ provider: 'fs', path: destDir }],
      },
    }
    fs.ensureDirSync(WORK_DIR)
    fs.removeSync(playbookSpecFile)
    process.chdir(WORK_DIR)
    fs.removeSync(destDir.split('/')[0])
  })

  after(() => {
    process.chdir(CWD)
    fs.removeSync(CONTENT_REPOS_DIR)
    if (process.env.KEEP_CACHE) {
      fs.removeSync(destDir.split('/')[0])
      fs.removeSync(playbookSpecFile)
    } else {
      fs.removeSync(WORK_DIR)
    }
  })

  it('should generate site into output directory specified in playbook file', async () => {
    fs.writeJsonSync(playbookSpecFile, playbookSpec, { spaces: 2 })
    await generateSite(['--playbook', playbookSpecFile])
    expect(ospath.join(destDir, '_'))
      .to.be.a.directory()
      .with.subDirs.with.members(['css', 'js', 'font', 'img'])
    expect(ospath.join(destDir, '_/css/site.css')).to.be.a.file()
    expect(ospath.join(destDir, '_/js/site.js')).to.be.a.file()
    expect(ospath.join(destDir, 'the-component'))
      .to.be.a.directory()
      .with.subDirs(['2.0'])
    expect(ospath.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    expect($('head > title')).to.have.text('Index Page :: The Site')
    // assert relative UI path is correct
    expect($('head > link[rel=stylesheet]')).to.have.attr('href', '../../_/css/site.css')
    expect($('script')).to.have.attr('src', '../../_/js/site.js')
    expect($('nav.navbar .navbar-brand .navbar-item')).to.have.attr('href', '../..')
    // assert current component version is correct
    expect($('.navigation-explore .current .title')).to.have.text('The Component')
    expect($('.navigation-explore .component.is-current .title')).to.have.text('The Component')
    expect($('.navigation-explore .component.is-current .version')).to.have.lengthOf(1)
    expect($('.navigation-explore .component.is-current .version a')).to.have.text('2.0')
    expect($('.navigation-explore .component.is-current .version.is-current a')).to.have.text('2.0')
    expect($('.navigation-explore .component.is-current .version.is-latest a')).to.have.text('2.0')
    // assert paths in navigation are relativized
    expect($('nav.nav-menu .nav-link')).to.have.attr('href', 'index.html')
    expect($('article h1')).to.have.text('Index Page')
    expect($('article img')).to.have.attr('src', '_images/activity-diagram.svg')
    expect(ospath.join(destDir, 'the-component/2.0/_images')).to.be.a.directory()
    expect(ospath.join(destDir, 'the-component/2.0/_images/activity-diagram.svg')).to.be.a.file()
    expect(ospath.join(destDir, 'the-component/2.0/the-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/the-page.html')
    expect($('nav.nav-menu .is-current-page')).to.have.lengthOf(1)
    expect($('nav.nav-menu .is-current-page > a.nav-link')).to.have.attr('href', 'the-page.html')
    expect($('.page-versions')).to.not.exist()
  }).timeout(TIMEOUT)

  it('should generate site into output directory specified in arguments', async () => {
    const destDirOverride = ospath.join(destDir, 'beta')
    fs.writeJsonSync(playbookSpecFile, playbookSpec, { spaces: 2 })
    await generateSite(['--playbook', playbookSpecFile, '--to-dir', destDirOverride])
    expect(ospath.join(destDirOverride, '_'))
      .to.be.a.directory()
      .with.subDirs.with.members(['css', 'js', 'font', 'img'])
    expect(ospath.join(destDirOverride, 'the-component'))
      .to.be.a.directory()
      .with.subDirs(['2.0'])
  }).timeout(TIMEOUT)

  it('should indexify URLs to internal pages', async () => {
    playbookSpec.urls = { html_extension_style: 'indexify' }
    fs.writeJsonSync(playbookSpecFile, playbookSpec, { spaces: 2 })
    await generateSite(['--playbook', playbookSpecFile])
    expect(ospath.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    expect($('article a.page')).to.have.attr('href', 'the-page/')
    expect($('nav.crumbs a')).to.have.attr('href', './')
    expect($('nav.nav-menu .nav-link')).to.have.attr('href', './')
    expect(ospath.join(destDir, 'the-component/2.0/the-page/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/the-page/index.html')
    expect($('nav.nav-menu .nav-link')).to.have.attr('href', '../')
    expect($('head > link[rel=stylesheet]')).to.have.attr('href', '../../../_/css/site.css')
  }).timeout(TIMEOUT)

  it('should qualify applicable links using site url if set in playbook', async () => {
    playbookSpec.site.url = 'https://example.com/docs/'
    fs.writeJsonSync(playbookSpecFile, playbookSpec, { spaces: 2 })
    await generateSite(['--playbook', playbookSpecFile])
    expect(ospath.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    expect($('head link[rel=canonical]')).to.have.attr('href', 'https://example.com/docs/the-component/2.0/index.html')
    expect($('nav.navbar .navbar-brand .navbar-item')).to.have.attr('href', 'https://example.com/docs')
  }).timeout(TIMEOUT)

  it('should provide navigation to multiple versions of a component', async () => {
    await repositoryBuilder
      .open()
      .then(() => repositoryBuilder.checkoutBranch('v1.0'))
      .then(() =>
        repositoryBuilder.addComponentDescriptorToWorktree({
          name: 'the-component',
          version: '1.0',
          nav: ['modules/ROOT/nav.adoc'],
        })
      )
      .then(() =>
        repositoryBuilder.importFilesFromFixture('the-component', {
          exclude: ['modules/ROOT/pages/new-page.adoc'],
        })
      )
      .then(() => repositoryBuilder.close('master'))
    playbookSpec.content.sources[0].branches = ['v2.0', 'v1.0']
    fs.writeJsonSync(playbookSpecFile, playbookSpec, { spaces: 2 })
    await generateSite(['--playbook', playbookSpecFile], {}, destDir)
    expect(ospath.join(destDir, 'the-component'))
      .to.be.a.directory()
      .with.subDirs(['1.0', '2.0'])
    expect(ospath.join(destDir, 'the-component/2.0/the-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/the-page.html')
    // assert that all versions of page are shown
    expect($('.page-versions')).to.exist()
    expect($('.page-versions .versions-menu-toggle')).to.have.text('2.0')
    expect($('.page-versions a.version')).to.have.lengthOf(2)
    expect($('.page-versions a.version.is-current'))
      .to.have.lengthOf(1)
      .and.to.have.text('2.0')
      .and.to.have.attr('href', 'the-page.html')
    expect($('.page-versions a.version:not(.is-current)'))
      .to.have.lengthOf(1)
      .and.to.have.text('1.0')
      .and.to.have.attr('href', '../1.0/the-page.html')
    expect(ospath.join(destDir, 'the-component/1.0/new-page.html')).to.not.be.a.path()
    expect(ospath.join(destDir, 'the-component/2.0/new-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/new-page.html')
    expect($('.page-versions a.version')).to.have.lengthOf(2)
    expect($('.page-versions a.version:not(.is-current)'))
      .to.have.lengthOf(1)
      .and.to.have.class('is-missing')
      .and.to.have.text('1.0')
      .and.to.have.attr('href', '../1.0/index.html')
    // assert that all versions of component are present in navigation explore panel
    expect($('.navigation-explore .component.is-current li.version')).to.have.lengthOf(2)
    expect(
      $('.navigation-explore .component.is-current li.version')
        .eq(0)
        .find('a')
    )
      .to.have.text('2.0')
      .and.to.have.attr('href', 'index.html')
    expect(
      $('.navigation-explore .component.is-current li.version')
        .eq(1)
        .find('a')
    )
      .to.have.text('1.0')
      .and.to.have.attr('href', '../1.0/index.html')
    expect(ospath.join(destDir, 'the-component/1.0/the-page.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/1.0/the-page.html')
    expect($('.navigation-explore .component.is-current .version')).to.have.lengthOf(2)
    expect($('.navigation-explore .component.is-current .version.is-latest a')).to.have.text('2.0')
    expect($('.navigation-explore .component.is-current .version.is-current a')).to.have.text('1.0')
  }).timeout(TIMEOUT)

  it('should provide navigation to all versions of all components', async () => {
    await repositoryBuilder
      .open()
      .then(() => repositoryBuilder.checkoutBranch('v1.0'))
      .then(() =>
        repositoryBuilder.addComponentDescriptorToWorktree({
          name: 'the-component',
          version: '1.0',
          nav: ['modules/ROOT/nav.adoc'],
        })
      )
      .then(() =>
        repositoryBuilder.importFilesFromFixture('the-component', {
          exclude: ['modules/ROOT/pages/new-page.adoc'],
        })
      )
      .then(() => repositoryBuilder.close('master'))

    await repositoryBuilder
      .init('the-other-component')
      .then(() =>
        repositoryBuilder.addComponentDescriptorToWorktree({
          name: 'the-other-component',
          version: 'master',
          start_page: 'core:index.adoc',
          nav: ['modules/core/nav.adoc'],
        })
      )
      .then(() => repositoryBuilder.importFilesFromFixture('the-other-component'))
      .then(() => repositoryBuilder.checkoutBranch('v1.0'))
      .then(() =>
        repositoryBuilder.addComponentDescriptorToWorktree({
          name: 'the-other-component',
          version: '1.0',
          start_page: 'core:index.adoc',
          nav: ['modules/core/nav.adoc'],
        })
      )
      .then(() => repositoryBuilder.close('master'))

    playbookSpec.content.sources[0].branches = ['v2.0', 'v1.0']
    playbookSpec.content.sources.push({
      url: ospath.join(CONTENT_REPOS_DIR, 'the-other-component'),
      branches: ['master', 'v1.0'],
    })
    fs.writeJsonSync(playbookSpecFile, playbookSpec, { spaces: 2 })
    await generateSite(['--playbook', playbookSpecFile])
    expect(ospath.join(destDir, 'the-other-component')).to.be.a.directory()
    expect(ospath.join(destDir, 'the-other-component/core/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-other-component/core/index.html')
    expect($('.navigation-explore .component')).to.have.lengthOf(2)
    // assert sorted by title
    expect(
      $('.navigation-explore .component')
        .eq(0)
        .find('.title')
    ).to.have.text('The Component')
    expect(
      $('.navigation-explore .component')
        .eq(1)
        .find('.title')
    ).to.have.text('The Other Component')
    // assert correct component is marked as current
    expect($('.navigation-explore .component').eq(1)).to.have.class('is-current')
    expect($('.navigation-explore .component.is-current a')).to.have.lengthOf(2)
    expect($('.navigation-explore .component.is-current a').eq(0)).to.have.text('master')
    expect($('.navigation-explore .component.is-current .version').eq(0))
      .to.have.class('is-current')
      .and.to.have.class('is-latest')
    expect(ospath.join(destDir, 'the-component/2.0/index.html')).to.be.a.file()
    $ = loadHtmlFile('the-component/2.0/index.html')
    // assert component link points to start page
    expect($('.navigation-explore .component:not(.is-current) a').eq(0)).to.have.attr(
      'href',
      '../../the-other-component/core/index.html'
    )
  }).timeout(TIMEOUT)

  // to test:
  // test if component start page is missing (current throws an error because its undefined)
  // path to images from topic dir
})
