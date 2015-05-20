var gulp = require('gulp');
var uglify = require('gulp-uglify');
var cssmin = require('gulp-minify-css');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var print = require('gulp-print');

var publicDir = 'public';

var src = {
  css: [ // TODO(pcsforeducation) should be bower based.
    'public/css/*.css',
    '!public/css/min.css'
  ],
  js: [
    //'bower_components/jquery/dist/jquery.js',
    // NOTE(pcsforeducation) Not sure what the deal is here..but bower version breaks
    'public/js/jquery.min.js',
    'bower_components/Chart.js/Chart.js',
    'bower_components/bootstrap/dist/js/bootstrap.js',
    'bower_components/underscore/underscore.js',
    'bower_components/zeroclipboard/dist/ZeroClipboard.js',
    'bower_components/socket.io-client/socket.io.js',
    'public/js/jquery.dataTables.js', // Apparently not available in bower..
    'public/js/funcs.js',
    'public/js/eventhandler.js'
  ]
};

var dist = {
  css: publicDir + '/css/',
  js: publicDir + '/js/'
};


gulp.task('css', function () {
  return gulp.src(src.css)
    .pipe(print())
    .pipe(concat('min.css'))
    //.pipe(cssmin())
    .pipe(gulp.dest(dist.css))
});

gulp.task('js', function () {
  return gulp.src(src.js)
    .pipe(print())
    .pipe(concat('min.js'))
    //.pipe(uglify())
    .pipe(gulp.dest(dist.js))
});

gulp.task('lint', function() {});

gulp.task('default', ['css', 'js']);
