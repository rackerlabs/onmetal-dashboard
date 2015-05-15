var gulp = require('gulp');
var uglify = require('gulp-uglify');
var cssmin = require('gulp-minify-css');
var concat = require('gulp-concat');
var rename = require('gulp-rename');

var publicDir = 'public';

var src = {
  css: ['public/css/*.css', '!public/css/min.css'],
  js: ['public/js/*.js', '!public/js/min.js']
};

var dist = {
  css: publicDir + '/css/',
  js: publicDir + '/js/'
};


gulp.task('css', function () {
  return gulp.src(src.css)
    .pipe(concat('min.css'))
    .pipe(cssmin())
    .pipe(gulp.dest(dist.css))
});

gulp.task('js', function () {
  return gulp.src(src.js)
    .pipe(concat('min.js'))
    .pipe(uglify())
    .pipe(gulp.dest(dist.js))
});

gulp.task('lint', function() {});

gulp.task('default', ['css', 'js']);
