'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');
var path = require('path');

var appPath = path.join(process.cwd(), 'app');

module.exports = yeoman.generators.Base.extend({
  initializing: function () {
    this.pkg = require('../package.json');
  },

  prompting: {

    askForNames: function askForNames() {
      var done = this.async();

      // Have Yeoman greet the user.
      this.log(yosay(
        'Welcome to the ' + chalk.red('ionic-gulp') + ' generator. Let\'s build an ionic app, shall we?'
      ));

      var prompts = [{
        type: 'input',
        name: 'appName',
        message: 'What\'s the app name?',
        default : this.appname // Default to current folder name
      },
      {
        type: 'input',
        name: 'userName',
        message: 'The author\'s name? (for config files)',
        default : 'Joe Dirt'
      },
      {
        type: 'input',
        name: 'userMail',
        message: 'Author email? (for config files)',
        default : 'email@example.com'

      }];

      this.prompt(prompts, function(props) {
        this.appName = props.appName;
        this.userName = props.userName;
        this.userMail = props.userMail;
        done();
      }.bind(this));
    },

    askForAppId: function askForAppId() {
      var done = this.async();
      this.prompt([{
        type: 'input',
        name: 'appId',
        message: 'The app id?',
        default : 'com.' + this._.classify(this.userName).toLowerCase() + '.' + this._.classify(this.appName).toLowerCase()
      }], function (props) {
        this.appId = props.appId;
        done();
      }.bind(this));
    }

  },

  writing: {

    setup: function () {
      this.fs.copyTpl(
        this.templatePath('_package.json'),
        this.destinationPath('package.json'),
        { appName: this._.underscored(this.appName),
          userName: this.userName,
          userEmail: this.userMail }
      );
      this.fs.copyTpl(
        this.templatePath('_bower.json'),
        this.destinationPath('bower.json'),
        { appName: this._.classify(this.appName),
          userName: this.userName,
          userEmail: this.userMail }
      );
      this.fs.copyTpl(
        this.templatePath('_config.xml'),
        this.destinationPath('config.xml'),
        { appName: this.appName,
          userName: this.userName,
          userEmail: this.userMail,
          widgetId: this.appId }
      );

      this.fs.copyTpl(
        this.templatePath('_gulpfile.js'),
        this.destinationPath('gulpfile.js'),
        { ngModulName: this._.classify(this.appName) }
      );

      this.fs.copy(
        this.templatePath('editorconfig'),
        this.destinationPath('.editorconfig')
      );
      this.fs.copy(
        this.templatePath('gitignore'),
        this.destinationPath('.gitignore')
      );
      this.fs.copy(
        this.templatePath('jshintrc'),
        this.destinationPath('.jshintrc')
      );

      this.mkdir('helpers');
      this.mkdir('www');

      this.fs.copy(
        this.templatePath('helpers/emulateios'),
        this.destinationPath('helpers/emulateios')
      );

    },

    projectfiles: function () {

      this.directory('app', 'app');
      this.directory('hooks', 'hooks');

      this.mkdir('app/styles/icons');
      this.mkdir('app/styles/images');
      this.mkdir('resources');

      this.fs.copyTpl(
        this.templatePath('index.html'),
        this.destinationPath('app/index.html'),
        { title: this.appName, ngModulName: this._.classify(this.appName)  }
      );

      this.fs.copyTpl(
        this.templatePath('app/views/home/home.html'),
        this.destinationPath('app/views/home/home.html'),
        { title: this.appName }
      );

      // controllers
      this.fs.copyTpl(
        this.templatePath('app/views/home/homeController.js'),
        this.destinationPath('app/views/home/homeController.js'),
        { ngModulName: this._.classify(this.appName) }
      );

      this.fs.copyTpl(
        this.templatePath('app/views/main/mainController.js'),
        this.destinationPath('app/views/main/mainController.js'),
        { ngModulName: this._.classify(this.appName) }
      );

      this.fs.copyTpl(
        this.templatePath('app/views/settings/settingsController.js'),
        this.destinationPath('app/views/settings/settingsController.js'),
        { ngModulName: this._.classify(this.appName) }
      );


      // utils
      this.fs.copyTpl(
        this.templatePath('app/lodash.js'),
        this.destinationPath('app/lodash.js'),
        { ngModulName: this._.classify(this.appName) }
      );

      // app

      this.fs.copyTpl(
        this.templatePath('app/app.js'),
        this.destinationPath('app/app.js'),
        { ngModulName: this._.classify(this.appName) }
      );

      this.fs.copy(
        this.templatePath('_vendor.json'),
        this.destinationPath('vendor.json')
      );

      this.fs.copy(
        this.templatePath('splash.png'),
        this.destinationPath('resources/splash.png')
      );

      this.fs.copy(
        this.templatePath('icon.png'),
        this.destinationPath('resources/icon.png')
      );
    }

  },

  install: function () {
    this.installDependencies({
      skipInstall: this.options['skip-install']
    });
  }
});
