/* eslint-env browser */
'use strict';

/**
 * Dynamically creates the JS Object passed to the highcharts constructor
 * on the front-end.
 *
 * @params {object} moodsData - the `states` key returned from `NodeCollection#get`
 * @returns {object} - JS Object used to construct a highcharts bar chart.
 */
function getBarChartObject(moodsData, flavors, conf_moods, conf_flavors) {
  var barChart = {
    chart: {
      type: 'bar'
    },
    title: {
      text: 'Summary (Bar)'
    },
    xAxis: {
      categories: [] // list of flavors + 'All' at the end
    },
    yAxis: {
      stackLabels: {
        enabled: true
      },
      min: 0,
      title: {
        text: 'Number of nodes'
      }
    },
    plotOptions: {
      series: {
        stacking: 'normal'
      }
    },
    colors: [], // hex colors
    series: [] // obj w/ keys: name, data
  };

  flavors.forEach(function (flavor) {
    barChart.xAxis.categories.push(flavor);
  });

  conf_moods.forEach(function (mood) {
    if (moodsData[mood.name].nodes.length === 0) {
      return;
    }

    barChart.colors.push(mood.chart.color);

    var seriesData = [];
    flavors.forEach(function (flavor) {
      seriesData.push(moodsData[mood.name][flavor].count);
    });
    seriesData.push(moodsData[mood.name].nodes.length);

    barChart.series.push({
      name: mood.display,
      data: seriesData
    });
  });
  barChart.xAxis.categories.push('All');

  return barChart;
}

/**
 * Dynamically draws a ChartJS chart of moodsData
 *
 * @params {object} moodsData - the `states` key returned from `NodeCollection#get`
 */
function drawPieChart(moodsData, flavors, conf_moods, conf_flavors) {
  var moodSeries = [];

  var pieChartOptions = {
    segmentShowStroke: true,
    segmentStrokeColor: "#fff",
    segmentStrokeWidth: 1,
    percentageInnerCutout: 0,
    animationSteps: 80,
    animationEasing: "easeOutBounce",
    animateRotate: true,
    animateScale: false,
    scaleShowLabels: true,
    legendTemplate : "<ul class=\"legend\"><% for (var i=0; i<segments.length; i++){%><li><span style=\"background-color:<%=segments[i].fillColor%>\"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>"
  };


  conf_moods.forEach(function (mood) {
    var moodData = moodsData[mood.name];
    // save space and reduce confusion by only adding data for
    // nodes in this mood.
    if (moodData.nodes.length === 0) {
      return;
    }
    var data = {
      label: mood.label,
      color: mood.color,
      highlight: mood.highlight,
      value: moodData.nodes.length
    };
    moodSeries.push(data);

  });
  var ctx = document.getElementById("pieChart").getContext("2d");
  var chart = new Chart(ctx).Pie(moodSeries, pieChartOptions);
  var legend = chart.generateLegend();
  $('#pieChartLegend').append(legend);
}

function expandAccordion() {
  $('.collapse').collapse('show');
}

function foldAccordion() {
  $('.collapse').collapse('hide');
}

var DataTableHelper = (function () {
  var _addCopyBox = function (clipboard, el, text) {
    var clipicon = $('<i />').addClass('fa fa-clipboard');
    var box = $('<button />', {
      'data-clipboard-text': text,
      title: text,
      html: clipicon
    })
      .addClass('copy-box pull-right');
    $(el).after(box);
    clipboard.clip(box);
  };

  var _createSearchableInputBox = function (dt, idx, name) {
    var input = $('<input />', {
      placeholder: 'Search ' + name,
      type: 'text'
    }).on('keyup change', function () {
      dt.column(idx)
        .search(this.value)
        .draw();
    });

    return input;
  };

  var _addSearchableInput = function (dt, idx, el, name) {
    var input = _createSearchableInputBox(dt, idx, name);
    $(el).append(input);
  };

  var _setPanelCount = function (dt, panel, title) {
    var panelString = title + ' (' + dt.rows().data().length + ')';
    panel.html(panelString);
  };


  /**
   * Creates a datatable by loading data through ajax.
   *
   * @param {object} params
   *    @param {jQuery element} el - table element to transform into a DataTable
   *    @param {object} panel - the accordion panel associated with this DataTable
   *    @param {string} title - the type of nodes displayed in this DataTable
   *    @param {} ajax - url endpoint that returns a json response to read from
   *    @param {object} styles - key value pair col_idx --> classes to apply
   *    @param {array} columns - data to pull from the ajax response
   *    @param {array} copyCols - array of column indicies to apply the clipboard code to
   *    @param {array} sortCols - index 0: column to sort on, index 1: 'asc' or 'desc' sort
   *    @param {ZeroClipboard} clipboard - ZeroClipboard instance
   * @returns {DataTable}
   */
  function _create(options) {
    // set defaults
    var el = $(options.el);
    var panel = options.panel;
    var title = options.title;
    var columns = options.columns;
    var ajaxEndpoint = options.ajax;
    var clipboard = options.clipboard;
    var styles = options.styles || {};
    var copyCols = options.copyCols || [];
    var sortCols = options.sortCols || [];

    var thead = $('<thead />').appendTo(el);
    var tfoot = $('<tfoot />').appendTo(el);

    var headers = $('<tr />').appendTo(thead);
    var secondRow = $('<tr />').appendTo(thead);
    var footer = $('<tr />').appendTo(tfoot);

    _.each(_.keys(columns), function (key) {
      headers.append($('<th>' + key + '</th>', { text: key }));
      secondRow.append($('<th />'));
      footer.append($('<th />'));
    });

    // Make DataTable
    var dt = el.DataTable({
      paging: true,
      bSortCellsTop: true,
      ajax: ajaxEndpoint,
      columns: _.values(columns),
      createdRow: function (row) {
        _.each(styles, function (classes, idx) {
          idx = parseInt(idx, 10);
          var col = $(row).find('> td').eq(idx);
          var text = col.text();

          if (text.length === 1 && text.charCodeAt(0) === 160) {
            // if we are only looking at an &nbsp; char, skip this iteration
            return;
          }

          var content = $('<div />', {
            text: text,
            title: text
          })
            .addClass(classes);

          if (idx === 0) {
            var link = document.location.pathname + '/detail/' + text;
            content.html('<a href="' + link + '">' + text + '</a>');
          } else if (alerts_url && idx === 1 && _.contains(copyCols, 1)) {
            var link = alerts_url + '/' + text;
            content.html('<a href="' + link + '">' + text + '</a>');
          }

          col.html(content);

          if (_.contains(copyCols, idx) && clipboard !== null) {
            content.addClass('pull-left');
            _addCopyBox(clipboard, content, text);
          }
        });
      },
      initComplete: function (settings) {
        _setPanelCount(this.api(), panel, title);
      }
    });

    // Set up search
    var headRows = el.find('thead tr');
    headers = $(headRows.eq(0)).find('th');
    secondRow = $(headRows.eq(1)).find('th');
    dt.columns().eq(0).each(function (idx) {
      var header = $(headers.eq(idx));
      _addSearchableInput(dt, idx, dt.column(idx).footer(), header.text());
      _addSearchableInput(dt, idx, secondRow.eq(idx), header.text());
    });

    // Draw table
    dt.page.len(25)
      .order(sortCols)
      .draw();

    return dt;
  }

  return {
    create: _create
  };
}());
