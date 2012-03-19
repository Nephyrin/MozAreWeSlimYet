
/*
 * Copyright © 2012 Mozilla Corporation
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

jQuery.new = function(e, attrs, css) {
  var ret = jQuery(document.createElement(e));
  if (attrs) ret.attr(attrs);
  if (css) ret.css(css);
  return ret;
};

// 10-class paired qualitative color scheme from http://colorbrewer2.org/.
var gDefaultColors = [
  "#1F78B4",
  "#33A02C",
  "#E31A1C",
  "#FF7F00",
  "#6A3D9A",
  "#A6CEE3",
  "#B2DF8A",
  "#FB9A99",
  "#FDBF6F",
  "#CAB2D6",
];

var gReleases = [
  {dateStr: "2011-03-03", name: "FF 5"},
  {dateStr: "2011-04-12", name: "FF 6"},
  {dateStr: "2011-05-24", name: "FF 7"},
  {dateStr: "2011-07-05", name: "FF 8"},
  {dateStr: "2011-08-16", name: "FF 9"},
  {dateStr: "2011-09-27", name: "FF 10"},
  {dateStr: "2011-11-08", name: "FF 11"},
  {dateStr: "2011-12-20", name: "FF 12"},
  {dateStr: "2012-01-31", name: "FF 13"},
  {dateStr: "2012-03-13", name: "FF 14"},
  {dateStr: "2012-04-24", name: "FF 15"},
  {dateStr: "2012-06-05", name: "FF 16"},
  {dateStr: "2012-07-17", name: "FF 17"},
  {dateStr: "2012-08-28", name: "FF 18"},
  {dateStr: "2012-10-09", name: "FF 19"}
];

var gReleaseLookup = {};

(function() {
  for (var i = 0; i < gReleases.length; i++) {
    // Seconds from epoch.
    gReleases[i].date = Date.parse(gReleases[i].dateStr) / 1000;
  }
})();

var gReleaseLookup = function() {
  var lookup = {};
  for (var i = 0; i < gReleases.length; i++) {
    lookup[gReleases[i].date] = gReleases[i].name;
  }
  return lookup;
}();

// Which series from series.json to graph where with what label
var gSeries = {
  "Resident Memory" : {
    'StartMemoryResidentV2':         "RSS: Fresh start",
    'StartMemoryResidentSettledV2':  "RSS: Fresh start [+30s]",
    'MaxMemoryResidentV2':           "RSS: After TP5",
    'MaxMemoryResidentSettledV2':    "RSS: After TP5 [+30s]",
    'MaxMemoryResidentForceGCV2':    "RSS: After TP5 [+30s, forced GC]",
    'EndMemoryResidentV2':           "RSS: After TP5, tabs closed",
    'EndMemoryResidentSettledV2':    "RSS: After TP5, tabs closed [+30s]"
  },
  "Explicit Memory" : {
    'StartMemoryV2':         "Explicit: Fresh start",
    'StartMemorySettledV2':  "Explicit: Fresh start [+30s]",
    'MaxMemoryV2':           "Explicit: After TP5",
    'MaxMemorySettledV2':    "Explicit: After TP5 [+30s]",
    'MaxMemoryForceGCV2':    "Explicit: After TP5 [+30s, forced GC]",
    'EndMemoryV2':           "Explicit: After TP5, tabs closed",
    'EndMemorySettledV2':    "Explicit: After TP5, tabs closed [+30s]"
  },
  "All-At-Once Test :: Resident Memory" : {
    'StartMemoryResident':         "RSS: Fresh start",
    'StartMemoryResidentSettled':  "RSS: Fresh start [+30s]",
    'MaxMemoryResident':           "RSS: After TP5",
    'MaxMemoryResidentSettled':    "RSS: After TP5 [+30s]",
    'MaxMemoryResidentForceGC':    "RSS: After TP5 [+30s, forced GC]",
    'EndMemoryResident':           "RSS: After TP5, tabs closed",
    'EndMemoryResidentSettled':    "RSS: After TP5, tabs closed [+30s]"
  },
  "All-At-Once Test :: Explicit Memory" : {
    'StartMemory':         "Explicit: Fresh start",
    'StartMemorySettled':  "Explicit: Fresh start [+30s]",
    'MaxMemory':           "Explicit: After TP5",
    'MaxMemorySettled':    "Explicit: After TP5 [+30s]",
    'MaxMemoryForceGC':    "Explicit: After TP5 [+30s, forced GC]",
    'EndMemory':           "Explicit: After TP5, tabs closed",
    'EndMemorySettled':    "Explicit: After TP5, tabs closed [+30s]"
  },
  "Miscellaneous Measurements" : {
    'MaxHeapUnclassifiedV2':  "Heap Unclassified: After TP5 [+30s]",
    'MaxJSV2':                "JS: After TP5 [+30s]",
    'MaxImagesV2':            "Images: After TP5 [+30s]"
  }
};

// Filled with /data/series.json
// FIXME this comment is wrong
// Contains info about graphs to create and sparse data for initial graphing.
// When we zoom in, ajax requests further data.
var gGraphData;
var gPerBuildData = {};
var gQueryVars = (function () {
  var ret = {};
  if (document.location.search) {
    var vars = document.location.search.slice(1).split('&');
    for (var x in vars) {
      x = vars[x].split('=');
      ret[decodeURIComponent(x[0])] = x.length > 1 ? decodeURIComponent(x[1]) : true;
    }
  }
  return ret;
})();

//
// Utility
//

function logMsg(obj) {
  if (window.console && window.console.log) {
    window.console.log(obj);
  }
}

function logError(obj) {
  if (window.console) {
    if (window.console.error)
      window.console.error(obj)
    else if (window.console.log)
      window.console.log("ERROR: " + obj);
  }
}

function prettyFloat(aFloat) {
  var ret = Math.round(aFloat * 100).toString();
  if (ret == "0") return ret;
  if (ret.length < 3)
    ret = (ret.length < 2 ? "00" : "0") + ret;
  
  var clen = (ret.length - 2) % 3;
  ret = ret.slice(0, clen) + ret.slice(clen, -2).replace(/[0-9]{3}/g, ',$&') + '.' + ret.slice(-2);
  return clen ? ret : ret.slice(1);
}

// TODO add a pad-to-size thing
function formatBytes(raw) {
  if (raw / 1024 < 2) {
    return prettyFloat(raw) + "B";
  } else if (raw / Math.pow(1024, 2) < 2) {
    return prettyFloat(raw / 1024) + "KiB";
  } else if (raw / Math.pow(1024, 3) < 2) {
    return prettyFloat(raw / Math.pow(1024, 2)) + "MiB";
  } else {
    return prettyFloat(raw / Math.pow(1024, 3)) + "GiB";
  }
}

// Round a date (seconds since epoch) to the nearest day.
function roundDay(date) {
  return Math.round(date / (24 * 60 * 60)) * 24 * 60 * 60;
}

// Round a date (seconds since epoch) up to the next day.
function roundDayUp(date) {
  return Math.ceil(date / (24 * 60 * 60)) * 24 * 60 * 60;
}

// Round a date (seconds since epoch) down to the previous day.
function roundDayDown(date) {
  return Math.floor(date / (24 * 60 * 60)) * 24 * 60 * 60;
}

//
// For the about:memory-esque display
//

// TODO document selectedNode return val
function treeExpandNode(node, noanimate) {
  if (!node.is('.hasChildren')) return;
  
  var subtree = node.find('.subtree');
  if (!subtree.length) {
    var subtree = $.new('div').addClass('subtree').hide();
    renderMemoryTree(subtree, node.data('nodeData'),
                              node.data('select'),
                              node.data('depth'));
    subtree.appendTo(node);
  }
  if (noanimate)
    subtree.show();
  else
    subtree.slideDown(250);
  node.children('.treeNodeTitle').find('.treeExpandClicker').text('[-]');
}

function treeCollapseNode(node) {
  node.children('.subtree').slideUp(250);
  node.children('.treeNodeTitle').find('.treeExpandClicker').text('[+]');
}

function treeToggleNode(node) {
  if (node.find('.subtree:visible').length)
    treeCollapseNode(node);
  else
    treeExpandNode(node);
}

// TODO document args
function renderMemoryTree(target, data, select, depth) {
  if (depth === undefined)
    depth = 0;
  
  // TODO Better selection of nodes that should show Mem/Pct
  var showMem = depth >= 2;
  var showPct = depth >= 3;
  
  // if select is passed as "a/b/c", split it so it is an array
  if (typeof(select) == "string") {
    select = select.split('/');
  }
  
  function defval(obj) {
    if (typeof(obj) == 'number')
      return obj
    return obj['_val'] == undefined ? null : obj['_val'];
  }
  
  // Sort nodes
  var rows = [];
  for (var node in data) {
    if (node == '_val')
      continue;
    rows.push(node);
  }
  if (showMem) {
    // Sort by memory size
    rows.sort(function (a, b) {
      var av = defval(data[a]) == null ? 0 : defval(data[a]);
      var bv = defval(data[b]) == null ? 0 : defval(data[b]);
      return bv - av;
    });
  } else {
    // Sort reverse alphanumeric
    rows = rows.sort(function (a, b) { return a == b ? 0 : a < b ? 1 : -1 });
  }
  
  // Add rows
  var parentval = defval(data);
  var node;
  while (node = rows.shift()) {
    var leaf = typeof(data[node]) == 'number';
    var treeNode = $.new('div')
                    .addClass('treeNode')
                    .data('nodeData', data[node])
                    .data('depth', depth + 1);
    var nodeTitle = $.new('div')
                     .addClass('treeNodeTitle')
                     .appendTo(treeNode);
    
    // Add value if inside a memNode
    var val = defval(data[node]);
    if (showMem && val != null) {
      // Value
      $.new('span').addClass('treeValue')
                  .text(formatBytes(val))
                  .appendTo(nodeTitle);
      // Percentage
      var pct = "("+prettyFloat(100* (val / parentval))+"%)";
      if (showPct && parentval != null) {
        $.new('span').addClass('treeValuePct')
                    .text(pct)
                    .appendTo(nodeTitle);
      }
    }
    
    // Add label
    var title = node;
    var subtitle;
    if (subtitle = /^(.+)\((.+)\)$/.exec(node)) {
      title = subtitle[1];
      subtitle = subtitle[2];
    }
    var label = $.new('span').addClass('treeNodeLabel')
                             .appendTo(nodeTitle).text(title);
    if (subtitle) {
      $.new('span').addClass('subtitle').text(' '+subtitle).appendTo(label);
    }

    // Add treeExpandClicker and click handler if node has children
    var expandClick = $.new('span').addClass('treeExpandClicker');
    nodeTitle.prepend(expandClick);
    if (!leaf) {
      expandClick.text('[+]');
      nodeTitle.click(function () { treeToggleNode($(this).parent()); });
      treeNode.addClass('hasChildren');
    }
    
    // Handle selecting a start node
    if (select && node == select[0]) {
      if (select.length == 1) {
        treeNode.addClass('highlight'); 
      } else {
        treeNode.data('select', select.splice(1));
      }
      treeExpandNode(treeNode, true);
    }
    
    target.append(treeNode);
  }
}

//
// Tooltip
//

function Tooltip(parent) {
  if ((!this instanceof Tooltip)) {
    logError("Tooltip() used incorrectly");
    return;
  }
  this.obj = $.new('div', { 'class' : 'tooltip' }, { 'display' : 'none' });
  this.content = $.new('div', { 'class' : 'content' }).appendTo(this.obj);
  if (parent)
    this.obj.appendTo(parent);
  
  this.obj.data('owner', this);
  this.onUnzoomFuncs = [];
}

Tooltip.prototype.isZoomed = function () { return this.obj.is('.zoomed'); }

Tooltip.prototype.append = function(obj) {
  this.content.append(obj);
}

Tooltip.prototype.empty = function() {
  this.content.empty();
}

Tooltip.prototype.hover = function(x, y, nofade) {
  if (this.isZoomed())
    return;
  
  var poffset = this.obj.parent().offset();
  
  var h = this.obj.outerHeight();
  var w = this.obj.outerWidth();
  var pad = 5;
  // Lower-right of cursor
  var top = y + pad;
  var left = x + pad;
  // Move above cursor if too far down
  if (window.innerHeight + document.body.scrollTop < poffset.top + top + h + 30)
    top = y - h - pad;
  // Move left of cursor if too far right
  if (window.innerWidth + document.body.scrollLeft < poffset.left + left + w + 30)
    left = x - w - pad;
  
  this.obj.css({
    top: top,
    left: left
  });
  
  // Show tooltip
  if (!nofade)
    this.obj.stop().fadeTo(200, 1);
}

Tooltip.prototype.unHover = function(nofade) {
  if (this.isZoomed())
    return;
  this.obj.stop().fadeTo(200, 0, function () { $(this).hide(); });
}

Tooltip.prototype.zoom = function(callback) {
  var w = this.obj.parent().width();
  var h = this.obj.parent().height();
    
  this.obj.show();
  this.obj.stop().addClass('zoomed').animate({
    width: '110%',
    height: '100%',
    left: '-5%',
    top: '-5%',
    opacity: 1
  }, 500, null, callback);
  
  // Close button
  var self = this;
  $.new('a', { class: 'closeButton', href: '#' })
   .text('[x]')
   .appendTo(this.obj).css('display', 'none')
   .fadeIn(500).click(function () {
     self.unzoom();
     return false;
   });
}

Tooltip.prototype.onUnzoom = function(callback) {
  if (this.isZoomed())
    this.onUnzoomFuncs.push(callback);
}

Tooltip.prototype.unzoom = function() {
  if (this.isZoomed() && !this.obj.is(':animated'))
  {
    var self = this;
    this.obj.animate({
        width: '50%',
        height: '50%',
        top: '25%',
        left: '25%',
        opacity: '0'
      }, 250, function() {
        self.obj.removeAttr('style').hide().removeClass('zoomed');
        self.obj.find('.closeButton').remove();
    });
    
    var callback;
    while (callback = this.onUnzoomFuncs.pop())
      callback.apply(this);
  }
}

//
// Ajax for getting more graph data
//

function getPerBuildData(buildname, success, fail) {
  if (gPerBuildData[buildname] !== undefined) {
    if (success instanceof Function) success.apply(null);
  } else {
    $.ajax({
      url: './data/' + buildname + '.json',
      success: function (data) {
        gPerBuildData[buildname] = data;
        if (success instanceof Function) success.call(null);
      },
      error: function(xhr, status, error) {
        if (fail instanceof Function) fail.call(null, error);
      },
      dataType: 'json'
    });
  }
}

//
// Plot functions
//

//
// Creates a plot, appends it to #graphs
// - axis -> { 'AxisName' : 'Nicename', ... }
//
function Plot(axis) {
  if (!this instanceof Plot) {
    logError("Plot() used incorrectly");
    return;
  }

  this.axis = axis;
  this.zoomed = false;
  this.dataRange = [ gGraphData['builds'][0]['time'],
                     gGraphData['builds'][gGraphData['builds'].length - 1]['time'] ];
  this.zoomRange = this.dataRange;
  
  this.container = $.new('div').addClass('graphContainer').appendTo($('#graphs'));
  this.rhsContainer = $.new('div').addClass('rhsContainer').appendTo(this.container);
  this.zoomOutButton = $.new('a', { href: '#', class: 'zoomOutButton' })
                        .appendTo(this.rhsContainer)
                        .text('Zoom Out')
                        .hide()
                        .click(function () {
                          self.setZoomRange();
                          return false;
                        });
  this.legendContainer = $.new('div').addClass('legendContainer').appendTo(this.rhsContainer);
  
  this.obj = $.new('div').addClass('graph').appendTo(this.container);
  this.flot = $.plot(this.obj,
    // Data
    this._buildSeries(),
    // Options
    {
      series: {
        lines: { show: true },
        points: { show: true }
      },
      grid: {
        color: "#aaa",
        hoverable: true,
        clickable: true
      },
      xaxis: {
        ticks: function(axis) {
          var points = [];
          for (var i = 0; i < gReleases.length; i++) {
            var date = gReleases[i].date;
            if (axis.min <= date && date <= axis.max) {
              points.push(date);
            }
          }
          
          if (points.length >= 2) {
            return points;
          }

          if (points.length == 1) {
            var minDay = roundDayUp(axis.min);
            var maxDay = roundDayDown(axis.max);

            if (Math.abs(points[0] - minDay) > Math.abs(points[0] - maxDay)) {
              points.push(minDay);
            }
            else {
              points.push(maxDay);
            }

            return points;
          }

          points.push(roundDayUp(axis.min));
          points.push(roundDayDown(axis.max));

          return points;
        },

        tickFormatter: function(val, axis) {
          var abbrevMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
                              'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          var date = new Date(val * 1000);

          var releaseName = "";
          if (gReleaseLookup[val]) {
            releaseName = '<div class="tick-release-name">' + gReleaseLookup[val] + '</div>';
          }

          return '<div class="tick-day-month">' + date.getUTCDate() + ' ' +
                 abbrevMonths[date.getUTCMonth()] + '</div>' +
                 '<div class="tick-year">' + date.getUTCFullYear() + '</div>' +
                 releaseName;
        }
      },
      yaxis: {
        ticks: function(axis) {
          // If you zoom in and there are no points to show, axis.max will be
          // very small.  So let's say that we'll always graph at least 32mb.
          var axisMax = Math.max(axis.max, 32 * 1024 * 1024);

          var approxNumTicks = 10;
          var interval = axisMax / approxNumTicks;

          // Round interval up to nearest power of 2.
          interval = Math.pow(2, Math.ceil(Math.log(interval) / Math.log(2)));

          // Round axis.max up to the next interval.
          var max = Math.ceil(axisMax / interval) * interval;

          // Let res be [0, interval, 2 * interval, 3 * interval, ..., max].
          var res = [];
          for (var i = 0; i <= max; i += interval) {
            res.push(i);
          }

          return res;
        },

        tickFormatter: function(val, axis) {
          return val / (1024 * 1024) + ' MiB';
        }
      },
      legend: {
        container: this.legendContainer
      },
      colors: gDefaultColors
    }
  );
  
  //
  // Background selector for zooming
  //
  var fcanvas = this.flot.getCanvas();
  this.zoomSelector = $.new('div', null,
                       { 
                         top: this.flot.getPlotOffset().top + 'px',
                         height: this.flot.height() - 10 + 'px', // padding-top is 10px
                       })
                       .addClass('zoomSelector')
                       .text("zoom")
                       .insertBefore(fcanvas);

  // For proper layering
  $(fcanvas).css('position', 'relative');
  
  //
  // Graph Tooltip
  //

  this.tooltip = new Tooltip(this.obj);
  var self = this;
  this.obj.bind("plotclick", function(event, pos, item) { self.onClick(item); });
  this.obj.bind("plothover", function(event, pos, item) { self.onHover(item, pos); });
  this.obj.bind("mouseout", function(event) { self.hideHighlight(); });
}

// Zoom this graph to given range. If called with no arguments, zoom all the way
// back out. range is of format [x1, x2]. this.dataRange contains the range of
// all data, this.zoomRange contains currently zoomed range if this.zoomed is
// true.
Plot.prototype.setZoomRange = function(range) {
    var zoomOut = false;
    if (range === undefined) {
      zoomOut = true;
      range = this.dataRange;
    }

    var self = this;
    if (this.zoomed && zoomOut) {
      // Zooming back out, remove zoom out button
      this.zoomed = false;
      self.zoomOutButton.hide();
    } else if (!this.zoomed && !zoomOut) {
      // Zoomed out -> zoomed in. Add zoom out button.
      this.zoomed = true;
      self.zoomOutButton.show();
    }

    this.zoomRange = range;
    var newseries = this._buildSeries(range[0], range[1]);
    this.flot.setData(newseries);
    this.flot.setupGrid();
    this.flot.draw();
    // setupGrid() reparents the grid, so we need to reparent the tooltip
    // such that it is last in the z-ordering
    this.tooltip.obj.appendTo(this.obj);
}

// RebuildsFIXME FIXME FIXME
Plot.prototype._buildSeries = function(start, stop) {
  var seriesData = [];
  if (start === undefined)
    start = gGraphData['builds'][0]['time'];
  if (stop == undefined)
    stop = gGraphData['builds'][gGraphData['builds'].length - 1]['time'];
  
  for (var axis in this.axis) {
    var series = [];
    var buildinfo = [];
    for (var ind in gGraphData['builds']) {
      var b = gGraphData['builds'][ind];
      if (b['time'] < start) continue;
      if (b['time'] > stop) break;
      series.push([ b['time'], gGraphData['series'][axis][ind] ]);
      buildinfo.push(b);
    }
    seriesData.push({ name: axis, label: this.axis[axis], data: series, buildinfo: buildinfo });
  }
  return seriesData;
}

Plot.prototype.onClick = function(item) {
  if (item) {
    // Zoom in on item
    var zoomedCallback;
    this.tooltip.zoom();
    var loading = $.new('h2', null, {
      display: 'none',
      'text-align': 'center',
    }).text('Loading test data...')
    this.tooltip.append(loading);
    loading.fadeIn();
      
    // Load per build data
    var canceled = false;
    var revision = item.series.buildinfo[item.dataIndex]['revision'];
    var self = this;
    getPerBuildData(revision, function () {
      // On get data (can be immediate)
      if (canceled) { return; }
      
      // Build zoomed tooltip
      var series_info = gGraphData['series_info'][item.series.name];
      var nodes = gPerBuildData[revision][series_info['test']]['nodes'];
      var datapoint = series_info['datapoint'];
      
      // series_info['datapoint'] might be a list of aliases for the datapoint.
      // find the one actually used in this node tree.
      if (datapoint instanceof Array) {
        for (var i = 0; i < datapoint.length; i++) {
          var dlist = datapoint[i].split('/');
          var p = nodes;
          while (dlist.length) {
            p = p[dlist.shift()];
            if (!p) break;
          }
          if (p) {
            datapoint = datapoint[i];
            break;
          }
        }
      }
      
      var memoryTree = $.new('div', { class: 'memoryTree' }, { display: 'none' });
      loading.css({ 'width' : '100%', 'position': 'absolute' }).fadeOut(250);
      
      // memoryTree title
      var treeTitle = $.new('div', { class: 'treeTitle' }).appendTo(memoryTree);
      $.new('h3').text('Part of test '+series_info['test'])
                 .appendTo(treeTitle);
      // datapoint subtitle
      $.new('div').addClass('highlight')
                  .text(datapoint.replace(/\//g, ' -> '))
                  .appendTo(treeTitle);
      renderMemoryTree(memoryTree, nodes, datapoint);
      
      self.tooltip.append(memoryTree);
      memoryTree.fadeIn();
    }, function (error) {
      // On failure
      loading.text("An error occured while loading the datapoint");
      self.tooltip.append($.new('p', null, { color: '#F55' }).text(status + ': ' + error));
    });
    // Cancel loading if tooltip is closed before the callback
    this.tooltip.onUnzoom(function () { canceled = true; });
  } else if (this.highlighted) {
    // Clicked on highlighted zoom space, do a graph zoom
    this.setZoomRange(this.highlightRange);

    // FIXME for issue #6, and also so the highlight range disappears when
    // we're zoomed all the way in, we should call onHover here.  But I don't
    // know how to do this.
  }
}

Plot.prototype.showHighlight = function(location, width) {
  if (!this.highlighted) {
    this.zoomSelector.stop().fadeTo(250, 1);
    this.highlighted = true;
  }

  var minZoomDays = 3;
  var xaxis = this.flot.getAxes().xaxis;
  if (xaxis.max - xaxis.min <= minZoomDays * 24 * 60 * 60) {
    this.highlighted = false;
    this.zoomSelector.stop().fadeTo(50, 0);
    return;
  }

  var off = this.flot.getPlotOffset();
  var left = location - width / 2;
  var overflow = left + width - this.flot.width() - off.left;
  var underflow = off.left - left;
  
  if (overflow > 0) {
    width = Math.max(width - overflow, 0);
  } else if (underflow > 0) {
    left += underflow;
    width = Math.max(width - underflow, 0);
  }
  
  // Calculate the x-axis range of the data we're highlighting
  this.highlightRange = [ xaxis.c2p(left - off.left), xaxis.c2p(left + width - off.left) ];
  
  this.zoomSelector.css({
    left: left + 'px',
    width: width + 'px'
  });
}

Plot.prototype.hideHighlight = function() {
  if (this.highlighted) {
    this.highlighted = false;
    this.zoomSelector.stop().fadeTo(250, 0);
  }
}

Plot.prototype.onHover = function(item, pos) {
  if ((!item || item !== this.hoveredItem) && !this.tooltip.isZoomed()) {
    if (item) {
      this.hideHighlight();
      // Tooltip Content
      this.tooltip.empty();
      var rev = item.series.buildinfo[item.dataIndex]['revision'].slice(0,12);
      var date = new Date(item.datapoint[0] * 1000).toUTCString();
      
      // Label
      this.tooltip.append($.new('h3').text(item.series['label']));
      // Build link / time
      this.tooltip.append($.new('p').append($.new('p').text(formatBytes(item.datapoint[1])))
                      .append($.new('b').text('build '))
                      .append($.new('a')
                              .attr('href', "http://hg.mozilla.org/mozilla-central/rev/" + rev)
                              .text(rev))
                      .append($.new('span').text(' @ ' + date)));
      
      // Tooltips move relative to the plot, not the page
      var offset = this.obj.offset();
      this.tooltip.hover(item.pageX - offset.left, item.pageY - offset.top, this.hoveredItem ? true : false);
    }
    else {
      if (this.hoveredItem)
        this.tooltip.unHover();
      // Move hover highlight for zooming
      var left = pos.pageX - this.flot.offset().left + this.flot.getPlotOffset().left;
      this.showHighlight(left, 400);
    }
    this.hoveredItem = item;
  }
}

$(function () {
  // Load graph data
  // Allow selecting an alternate series
  var series = gQueryVars['series'] ? gQueryVars['series'] : 'series';
  var url = './data/' + series + '.json';
  $.ajax({
    url: url,
    success: function (data) {
      gGraphData = data;
      $('#graphs h3').remove();
      for (var graphname in gSeries) {
        $.new('h2').text(graphname).appendTo($('#graphs'));
        new Plot(gSeries[graphname]);
      }
    },
    error: function(xhr, status, error) {
      $('#graphs h3').text("An error occured while loading the graph data (" + url + ")");
      $('#graphs').append($.new('p', null, { 'text-align': 'center', color: '#F55' }).text(status + ': ' + error));
    },
    dataType: 'json'
  });
  
  // Close zoomed tooltips upon clicking outside of them
  $('body').bind('click', function(e) {
    if (!$(e.target).is('.tooltip') && !$(e.target).parents('.graph').length)
      $('.tooltip.zoomed').each(function(ind,ele) {
        $(ele).data('owner').unzoom();
      });
  });
});
