'use strict';

var appName     = '<%= ngModulName %>',
    gulp        = require('gulp'),
    plugins     = require('gulp-load-plugins')(),
    del         = require('del'),
    beep        = require('beepbeep'),
    express     = require('express'),
    path        = require('path'),
    open        = require('open'),
    stylish     = require('jshint-stylish'),
    connectLr   = require('connect-livereload'),
    streamqueue = require('streamqueue'),
    runSequence = require('run-sequence'),
    merge       = require('merge-stream'),
    ripple      = require('ripple-emulator'),
    /* Parse arguments */
    args        = require('yargs')
      .alias('e', 'emulate')
      .alias('b', 'build')
      .alias('r', 'run')
      // remove all debug messages (console.logs, alerts etc) from release build
      .alias('release', 'strip-debug')
      .default('build', false)
      .default('port', 9000)
      .default('strip-debug', false)
      .argv,
    build = !!(args.build || args.emulate || args.run),
    emulate = args.emulate,
    run = args.run,
    port = args.port,
    stripDebug = !!args.stripDebug,
    targetDir = path.resolve(build ? 'www' : '.tmp');

// if we just use emualate or run without specifying platform, we assume iOS
// in this case the value returned from yargs would just be true
if (emulate === true) {
  emulate = 'ios';
}
if (run === true) {
  run = 'ios';
}

// global error handler
var errorHandler = function (error) {
  if (build) {
    throw error;
  } else {
    beep(2, 170);
    plugins.util.log(error);
  }
};


// clean target dir
gulp.task('clean', function (done) {
  del([targetDir], done);
});

// precompile .scss and concat with ionic.css
gulp.task('styles', function () {

  var options = {
    project  : path.join(__dirname, 'app', 'styles'),
    http_path: "/",
    css      : 'stylesheets',
    sass     : 'sass',
    images   : "images",
    style    : build ? 'compressed' : 'expanded'
  };


  var sassStream = gulp.src('./app/styles/sass/main.scss')
    .pipe(plugins.compass(options))
    .pipe(plugins.autoprefixer('last 1 Chrome version', 'last 3 iOS versions', 'last 3 Android versions'));
  /*var sassStream = plugins.rubySass('app/styles/main.scss', options)
   .pipe(plugins.autoprefixer('last 1 Chrome version', 'last 3 iOS versions', 'last 3 Android versions'))*/

  var cssStream = gulp
    .src('bower_components/ionic/css/ionic.min.css');

  return streamqueue({objectMode: true}, cssStream, sassStream)
    .pipe(plugins.concat('main.css'))
    .pipe(plugins.if(build, plugins.stripCssComments()))
    .pipe(plugins.if(build && !emulate, plugins.rev()))
    .pipe(gulp.dest(path.join(targetDir, 'dist')))
    .on('error', errorHandler);
});


// build templatecache, copy scripts.
// if build: concat, minsafe, uglify and versionize
gulp.task('scripts', function () {
  var dest = path.join(targetDir, 'dist');

  var minifyConfig = {
    collapseWhitespace       : true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes    : true,
    removeComments           : true
  };

  // prepare angular template cache from html templates
  // (remember to change appName var to desired module name)
  var templateStream = gulp
    .src('views/**/*.html', {cwd: 'app'})

    .pipe(plugins.angularTemplatecache('templates.js', {
      root   : 'views/',
      module : appName,
      htmlmin: build && minifyConfig
    }));

  var scriptStream = gulp
    .src(['templates.js', 'app.js', 'lodash.js', 'views/**/*.js'], {cwd: 'app'})

    .pipe(plugins.if(!build, plugins.changed(dest)));

  return streamqueue({objectMode: true}, scriptStream, templateStream)
    .pipe(plugins.if(build, plugins.ngAnnotate()))
    .pipe(plugins.if(stripDebug, plugins.stripDebug()))
    .pipe(plugins.if(build, plugins.concat('app.js')))
    .pipe(plugins.if(build, plugins.uglify()))
    .pipe(plugins.if(build && !emulate, plugins.rev()))

    .pipe(gulp.dest(dest))

    .on('error', errorHandler);
});

// copy fonts
gulp.task('fonts', function () {
  return gulp
    .src(['app/styles/fonts/*.*', 'bower_components/ionic/fonts/*.*'])

    .pipe(gulp.dest(path.join(targetDir, 'fonts')))

    .on('error', errorHandler);
});


// copy templates
gulp.task('templates', function () {
  return gulp.src('app/views/**/*.html')
    .pipe(gulp.dest(path.join(targetDir, 'views')))

    .on('error', errorHandler);
});

// generate iconfont
gulp.task('iconfont', function () {
  return gulp.src('app/styles/icons/*.svg', {
    buffer: false
  })
    .pipe(plugins.iconfontCss({
      fontName  : 'ownIconFont',
      path      : 'app/styles/icons/own-icons-template.css',
      targetPath: '../stylesheets/own-icons.css',
      fontPath  : '../fonts/'
    }))
    .pipe(plugins.iconfont({
      fontName: 'ownIconFont'
    }))
    .pipe(gulp.dest(path.join(targetDir, 'fonts')))
    .on('error', errorHandler);
});

// copy images
gulp.task('images', function () {
  return gulp.src('app/styles/images/**/*.*')
    .pipe(gulp.dest(path.join(targetDir, 'images')))

    .on('error', errorHandler);
});


// lint js sources based on .jshintrc ruleset
gulp.task('jsHint', function (done) {
  return gulp
    .src('app/views/**/*.js')
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter(stylish))

    .on('error', errorHandler);
  done();
});

// concatenate and minify vendor sources
gulp.task('vendor', function () {
  var dest = path.join(targetDir, 'dist');
  var vendorFiles = require('./vendor.json');

  return gulp.src(vendorFiles)
    .pipe(plugins.concat('vendor.js'))
    .pipe(plugins.if(build, plugins.uglify()))
    .pipe(plugins.if(build, plugins.rev()))

    .pipe(gulp.dest(dest))

    .on('error', errorHandler);
});


// inject the files in index.html
gulp.task('index', ['jsHint', 'scripts'], function () {

  // build has a '-versionnumber' suffix
  var cssNaming = 'dist/main*.css',
      env = 'dev',
      filename;

  if (emulate) {
    env = 'test';
  } else if (build || run) {
    env = process.env.TARGET || 'test';
  }


  // Read the settings from the right file
  filename = 'config.' + env + '.json';

  // inject vendor.js


  // injects 'src' into index.html at position 'tag'
  var _inject = function (src, tag) {
    return plugins.inject(src, {
      starttag    : '<!-- inject:' + tag + ':{{ext}} -->',
      read        : false,
      addRootSlash: false
    });
  };

  // get all our javascript sources
  // in development mode, it's better to add each file seperately.
  // it makes debugging easier.
  var _getAllScriptSources = function () {
    var scriptStream = gulp.src(['dist/app.js', 'dist/lodash.js', 'dist/templates.js', 'dist/*/*.js'], {cwd: targetDir});
    return streamqueue({objectMode: true}, scriptStream);
  };

  return gulp.src('app/index.html')
    // inject css
    .pipe(_inject(gulp.src(cssNaming, {cwd: targetDir}), 'app-styles'))
    // inject vendor.js
    .pipe(_inject(gulp.src('dist/vendor*.js', {cwd: targetDir}), 'vendor'))
    // inject app.js (build) or all js files indivually (dev)
    .pipe(plugins.if(build,
      _inject(gulp.src('dist/app*.js', {cwd: targetDir}), 'app'),
      _inject(_getAllScriptSources(), 'app')
    ))
    // inject config
    .pipe(plugins.inject(gulp.src([path.join('app', 'config', filename)]), {
        starttag : '<!-- inject:config -->',
        transform: function (filepath, file) {
          var settings = JSON.parse(file.contents.toString('utf8')),
              insertString = '<script type="application/javascript">';

          insertString += 'angular.module("' + appName + '",[])';

          for (var key in settings) {
            insertString += '.constant("' + key + '", "' + settings[key] + '")';
          }
          insertString += ';</script>';

          return (insertString);
        }
      }
    ))

    .pipe(gulp.dest(targetDir))
    .on('error', errorHandler);
});

// start local express server
gulp.task('serve', function () {
  express()
    .use(!build ? connectLr() : function () {
    })
    .use(express.static(targetDir))
    .listen(port);
  open('http://localhost:' + port + '/');
});

// ionic emulate wrapper
gulp.task('ionic:emulate', plugins.shell.task([
  'ionic emulate ' + emulate + ' --livereload --consolelogs'
]));

// ionic run wrapper
gulp.task('ionic:run', plugins.shell.task([
  'ionic run ' + run
]));

// ionic resources wrapper
gulp.task('icon', plugins.shell.task([
  'ionic resources --icon'
]));
gulp.task('splash', plugins.shell.task([
  'ionic resources --splash'
]));
gulp.task('resources', plugins.shell.task([
  'ionic resources'
]));

// select emulator device
gulp.task('select', plugins.shell.task([
  './helpers/emulateios'
]));

// ripple emulator
gulp.task('ripple', ['scripts', 'styles', 'watchers'], function () {

  var options = {
    keepAlive: false,
    open     : true,
    port     : 4400
  };

  // Start the ripple server
  ripple.emulate.start(options);

  open('http://localhost:' + options.port + '?enableripple=true');
});


// start watchers
gulp.task('watchers', function () {
  plugins.livereload.listen();
  gulp.watch('app/styles/**/*.scss', ['styles']);
  gulp.watch('app/styles/fonts/**', ['fonts']);
  gulp.watch('app/styles/icons/**', ['iconfont']);
  gulp.watch('app/styles/images/**', ['images']);
  gulp.watch('app/*.js', ['index']);
  gulp.watch('app/views/**/*.js', ['index']);
  gulp.watch('./vendor.json', ['vendor']);
  gulp.watch('app/views/**/*.html', ['index']);
  gulp.watch('app/index.html', ['index']);
  gulp.watch('app/config/*.json', ['index']);
  gulp.watch(targetDir + '/**')
    .on('change', plugins.livereload.changed)
    .on('error', errorHandler);
});

// no-op = empty function
gulp.task('noop', function () {
});

// our main sequence, with some conditional jobs depending on params
gulp.task('default', function (done) {
  runSequence(
    'clean',
    'iconfont',
    [
      'fonts',
      'templates',
      'styles',
      'images',
      'vendor'
    ],
    'index',
    build ? 'noop' : 'watchers',
    build ? 'noop' : 'serve',
    emulate ? ['ionic:emulate', 'watchers'] : 'noop',
    run ? 'ionic:run' : 'noop',
    done);
});
