# Frequently Asked Questions

[TOC]

## What is this site?

*Are We Slim Yet?* is a Firefox memory benchmark and a site for visualizing the
historic results of that benchmark.

Are we Slim Yet? was created by John Schoenick of Mozilla's [MemShrink][]
team.  The MemShrink team was formed in June 2011, and is tasked with monitoring
and reducing Firefox's memory usage.

This site allows us to observe long-term trends in memory usage and hopefully
catch regressions before we ship them to users.

Come say hi on [GitHub][awsy-github].

## Exactly which versions of Firefox are plotted here?

For each [change][pushlog] to Mozilla's central repository, our build
infrastructure generates a [build][tinderbox builds] which we test and include
in the graphs here.

We don't keep these per-change builds are around forever, so for data points
before March 2012, we tested Firefox [nightly builds][].

A push may include multiple changes, and we have the ability to build and test
individual changes, where necessary.  We use this to help us figure out exactly
where an increase in memory usage came from.

We run against Linux 64-bit (non-pgo) builds, so platform-specific changes may
not be captured here.

The dates on the x-axis indicate when we switched development *to* a given
version.  For example, we started developing Firefox 5 on March 3, 2011, but we
didn't release it for three months after that.  In the meantime, we started on
the code which would become Firefox 6 on April 12.

The memory usage of version that we shipped as "Firefox N" corresponds roughly
to the points directly under the "FF N+1" line, but we normally make some
changes to Firefox N even after we started working on Firefox N+1, and those
changes aren't plotted here.

## How is this data generated?

We run the target build of Firefox (Linux 64-bit, non-pgo) through a benchmark
script (written using [mozmill][]) and measure its memory usage at a variety of
points along the way.  The testing procedure is as follows.

  * Start the browser, record **fresh start** memory.
  * Run Mozilla's [TP5][] pageload benchmark 5 times.  TP5 loads 100 popular
    webpages, served from a local webserver.  We load the pages round-robin into
    30 different tabs, with a 10 second delay between pageloads.
  * Record **after TP5** memory usage.
  * Sit idle for 30 seconds and record **after TP5 [+30s]**.
  * Force a garbage collection and measure **after TP5 [+30s, forced GC]**.
  * Close all open tabs and record **after TP5, tabs closed** and then
    **after TP5, tabs closed [+30s]**.

Every time we measure memory usage, we also collect a full snapshot of
about:memory.  You can browse these snapshots by clicking on any point in the
graph. The data that was used for generating that particular point will be
highlighted in red.

## What's the difference between "resident memory" and "explicit"?

**Resident memory** (also known as "resident set size" or RSS) is the single
best measure of a process's memory usage.  RSS measures the amount of physical
memory (RAM) Firefox's process is using.  This counts code, but does not count
memory paged out to disk.

**Explicit memory** is memory that Firefox has explicitly allocated, either
via `malloc` or `mmap`.  The explicit measure is particularly useful when
checking for memory leaks.  If the measured explicit value at two points in time
is the same, then we've `free`'d as much as we've `malloc`'ed between those two
points in time.  In contrast, the RSS values at those two points might not be
the same, for example because our heap might become fragmented.

The *explicit* measurement comes from Firefox itself. It has had bugs in the
past, and the exact set of allocations it covers has changed over time.  It is
therefore tricky to compare *explicit* measurements between two distant
builds.  The *resident* numbers come from the operating system and should be
comparable between all builds.

## Why are there gaps in the graphs?
Gaps indicate areas where the relevant builds failed to be fully tested, or
where the data being graphed was not available. The most notable is a gap from
July to August 2011 where the TP5 pageset would actually trigger a crash in our
test framework (yikes!).

Much of the code for generating the *explicit* numbers was not stable until
around July 2011.  This explains the lack of earlier data as well as the rather
sporadic data points for the first few months.

## "RSS: After TP5, tabs closed [+30s]" is almost twice as high as "RSS: Fresh start" &mdash; doesn't that mean Firefox leaks a ton of memory?

Well, not exactly.

If you look at the equivalent *explicit* numbers, you'll see that the *after
TP5, tabs closed [+30s]* measure is very close to the *fresh start* measure.
This means Firefox is releasing most all of the memory it allocates, so it is
not leaking memory, at least not in the traditional sense.

But if Firefox has freed all the memory it allocated during the test, why is it
using more memory after the test?  Our data shows that most of the difference is
due to *heap fragmentation*.  Before the test, all the objects on our heap are
tightly packed.  But after the test, our heap uses twice as much space for the
same amount of storage, because the objects on the heap now have gaps between
them.

We're [actively exploring][match-startup-mem] ways to minimize heap
fragmentation, by [using a new version of our heap allocator][jemalloc2] and
trying to minimize the number of calls we make to `malloc`.

Our data shows that the peak memory usage after the first run of TP5 is the same
as our peak memory usage after the last run of TP5.  This means that, although
Firefox remembers how much memory it used at its peak, its memory usage
should not significantly increase over time.

## This is all well and good, but my Firefox still leaks like a sieve.

We're sorry to hear that, and we'd like to help.  Here are some diagnostics you
can try.

#### Check your version

First, double-check that you're on the latest version of Firefox.  We won't be
able to help much if you're running an old version.  You can check for updates
in the "Help -> About Firefox" menu.

#### Check for add-on leaks

In our experience, most severe leaks in Firefox these days are caused by leaky
add-ons.  We know how important add-ons are to our users, and Mozilla's add-ons
team has been doing heroic work to find and address leaks in add-ons before our
users are affected.  But this work is still in its infancy, and there are a lot
of add-ons we haven't yet tested.

To see if add-ons are causing your problems, try [restarting Firefox in safe
mode][safe mode], and see if the problem persists.  If safe mode solves your
problem, congratulations!  You probably have a leaky add-on.  Now you probably
want to know which one is to blame.

To figure out which add-on is leaking, start Firefox up outside safe mode,
disable half of your add-ons, and see if the leaks persist.  Repeat this process
to narrow down to just one (or a few) leaky add-ons.  (If it takes a long time
for the leak to become apparent, you can look for [zombie compartments][], a
common type of leak which is easy to identify even before Firefox starts using
gigabytes of memory.)

Once you have figured out which add-on(s) is (are) leaking, you're almost done!
Just [file a bug][]. Please check that "\[MemShrink\]" is in the "status
whiteboard" field, but don't worry about the other metadata like the component;
we'll fix it.  (You may have to click "show advanced fields" in order to see
the status whiteboard field.)

If you file a bug, we'll take care of contacting the add-on developer and
helping him or her fix the problem.

If you have trouble with any of this, find us on [IRC][] (irc.mozilla.org,
\#memshrink).  We're happy to help.

#### If Firefox still leaks, even in safe mode, file a bug!

If the latest version of Firefox leaks for you, even in safe mode, we
definitely want to hear about it.  Please, *please* [file a bug][] (and please
check that \[MemShrink\] is in the status whiteboard).

If you don't want to file a bug, find us on IRC (irc.mozilla.org, \#memshrink),
send smoke signals...do something!  We need your help, particularly in this
case.

[tinderbox builds]: ftp://ftp.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/mozilla-central-linux64/
[nightly builds]: http://nightly.mozilla.org/
[IRC]: https://wiki.mozilla.org/IRC
[tbpl]: https://tbpl.mozilla.org/
[pushlog]: http://hg.mozilla.org/mozilla-central/pushloghtml
[awsy-github]: https://github.com/Nephyrin/MozAreWeSlimYet
[MemShrink]: https://wiki.mozilla.org/Performance/MemShrink
[TP5]: https://wiki.mozilla.org/Buildbot/Talos#tp5
[mozmill]: https://github.com/mozautomation/mozmill
[match-startup-mem]: https://bugzilla.mozilla.org/show_bug.cgi?id=668809
[jemalloc2]: https://bugzilla.mozilla.org/show_bug.cgi?id=580408
[safe mode]: http://support.mozilla.org/en-US/kb/Safe%20Mode
[zombie compartments]: https://developer.mozilla.org/en/Zombie_compartments#Reactive_checking
[file a bug]: https://bugzilla.mozilla.org/enter_bug.cgi?product=Core&component=General&status_whiteboard=[MemShrink]
