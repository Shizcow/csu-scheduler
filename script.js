/*
BUGS:
Switching from automatic to manual:
if an alternate course is on the board, it reverts to its home course instead of keeping its alt

ADD:
In automatic mode, include a big indicator when there is no valid sched
*/
let test_percent_cap = 1;
let chunk = 500;
Vue.use(VueResource);
var server_cx = function(h) { return 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/' + h; };

let xhr = new XMLHttpRequest();
let xhrzip = function(url, onstate){
    xhr.onreadystatechange = onstate;

    xhr.open("GET", url);
    xhr.setRequestHeader("Accept", 'application/json, text/javascript, */*; q=0.01')
    xhr.setRequestHeader("Accept-Language", 'en-US,en;q=0.5')
    let data = {
      headers: {
      Host: 'bannerxe.is.colostate.edu',
	    Referer: 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/classSearch/classSearch',
	    Connection: 'keep-alive'
	},
	method: 'GET'
    };
    xhr.withCredentials = true;
    xhr.send(JSON.stringify(data));
}

class Lazy{ // a memoized and simplified version of the Lazy class you can find online
    constructor(inputgen){
        this.core = inputgen;
        this.data = [];
    	this.filters = [];
	this.done = false;
    }
    get(i){
        while(!this.done && (this.data.length <= i)){
	    var tmp = this.core.next();
	    if(tmp.done){
		this.done = true;
		break;
	    }
	    if(this.filters.reduce(function(acc, cur_filter){ // run all filters on value
		return acc && cur_filter(tmp.value);
	    }, true)){
		var value = tmp.value;
		var selected = value.filter(function(course){
		    return !course.home.alts.concat(course.home).includes(app.course);
		});
		this.data.push({value: value, selected: selected});
            }
	}
	var data = this.data[i];
	app.selected = data.selected;
        return data.value;
    }
    filter(filter_fun){
	this.filters.push(filter_fun);
	return this;
    }
}

var app = new Vue(
    {
	el: '#app',
	data:
	{
	    mode: "Manual",
            hovering: null,
            currentstorage: null,
            localStorage: [],
            terms: [],
            term: "",
            courses: [],
            course: null,
	    courses_list: [],
	    course_list_selection: 0,
	    savedCourseGenerator: ["0"],
            selected: [],
            search: "",
            closed: false,
            changed: false,
            justLoaded: true,
            showExport: false,
            description: false,
	    percent: "",
            safari: navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1
	},
	mounted: function()
	{
            this.$el.style.display = 'block';
	    xhrzip(server_cx("classSearch/getTerms?searchTerm=&offset=1&max=10&_=1554348528566"), function() {
		if (this.readyState === 4 && this.status === 200) {
		    let response = JSON.parse(this.responseText);
		    app.terms = response;
		    console.log(response);
		    if (app.hashExists() && (index = app.terms.indexOf(location.hash.slice(1, 6))) > -1)
		    {
			app.term = app.terms[index];
		    }
		    else
		    {
			app.term = app.terms[0];
		    }
		    app.changedTerm(true);
		    if(localStorage.schedules) app.localStorage = JSON.parse(localStorage.schedules);
		}
	    });
	},
	computed:
	{
            totalCredits: function()
            {
		return this.selected.map(function(c){
		    return c.scheduleTypeDescription == "Laboratory" ? 0 : c.creditHours ? c.creditHours : c.creditHourLow ? c.creditHourLow : c.creditHourHigh ? c.creditHourHigh : 0;
		}).concat(0).reduce(function(a, b){
		    return a + b;
		});
            },
	},
	methods:
	{
            fetchDescription: function(course) {
		ga('send', 'event', 'description', 'fetch');
                
		if(!course.description) {
		    xhrzip(server_cx('searchResults/getCourseDescription/?term=' + course.term.toString() + '&courseReferenceNumber=' + course.courseReferenceNumber.toString()), function(){
			Vue.set(course, 'description', this.responseText.replace(/<br>/g, "\r\n").replace(/<BR>/g, "\r\n").trim());
		    });
		}
		this.description = course;
            },
            filterSearch: function(course) {
		if(this.selected.indexOf(course) !== -1) return false;
		if (!this.closed && !course.seatsAvailable) return false;

		if(this.search) {
                    var search = this.search.toLowerCase();
                    return (course.subject + ' ' + course.courseNumber).toLowerCase().indexOf(search) > -1 ||
			course.courseTitle.toLowerCase().indexOf(search) > -1;
		}
		if(this.mode == "Automatic"){
		    if(this.selected.reduce(function(acc, course){
			return course ? acc.concat(course.home.alts.concat(course.home)) : acc;
		    }, []).includes(course))
			return false;
		}
		return true;
            },
	    autoFilter: function(courses){ // remove all consecutive duplicates - only in automatic mode
		return this.mode == "Manual" ? courses : courses.reduce(function(acc, cur){
		    if(acc.length > 0){
			if(cur.subjectCourse != acc[acc.length-1].subjectCourse){
			    return acc.concat(cur); // add new
			} else {
			    return acc; // ignore duplicate
			}
		    } else {
			return [cur]; // first iteration - set up accumulator
		    }
		}, []);
	    },
	    // check if check_course exists within the alts of course_alts, but ONLY if we're in automatic mode
	    autoInAlts: function(check_course, course_alts){ // pretty much just fixes a render bug
		if(course_alts == null)
		    return false; // we'll get an error in a few lines if we don't do this
		if(this.mode == "Manual")
		    return check_course == course_alts;
		return check_course.home == course_alts.home; // automatic - if check_course is course_alts or is in its alts
	    },
	    // return a Lazy object which spits out valid schedules, and cache it so that Vue templating doesnt calculate it a million times
	    autoConstruct: function(courses){
		if(courses[0] == null) return {get: function(i){return []}}; // no courses - go no further
		if(courses.slice(-1)[0]==null) // remove null at end when no class is selected
		    courses.pop();
		if(courses.map(function(el){return el.courseReferenceNumber;}).join() == this.savedCourseGenerator)
		    return this.courses_generator; // don't have to run the calculation for every hour in every day
		if(this.mode == "Manual"){
		    this.savedCourseGenerator = courses.map(function(el){return el.courseReferenceNumber;}).join();
		    this.courses_generator = {get: function(i){return courses;}};
		    return this.courses_generator;
		}
		//automatic generator
		if(courses.map(function(el){return el.home.courseReferenceNumber;}).join() == this.savedCourseGenerator)
		    return this.courses_generator; // don't have to run the calculation for every hour in every day
		this.courses_generator = new Lazy(this.cartesianProduct(courses.map(function(course){
		    return course.home.alts.concat(course.home); // expand course to list of [alts...]
		}))).filter(this.schedCompat);
		this.savedCourseGenerator = courses.map(function(el){return el.home.courseReferenceNumber;}).join();
		return this.courses_generator;
	    },
	    //Generates a Cartesian Product with given dimensions
	    //Example: [['a', 'b'], ['c', 'd']] => [['a', 'c'],['a', 'd'],['b', 'c'],['b', 'd']]
	    cartesianProduct: function*(dimensions){
		if(dimensions.length <= 1){// no need to calculate for 1 length lists (0 too just in case) - just yield each schedule
		    for(var i = 0; i<dimensions[0].length; ++i)
			yield [dimensions[0][i]]; // wrap each course as its own schedule
		    return; // generators are weird
		}
		var stack = new Array(dimensions.length).fill(0, 0, dimensions.length);
		while(true){ // This incriments over stack, treating it like a mixed-base number
		    for(var i = 0; i<stack.length-1; ++i){ // check stack state for carry
			if(stack[i] > dimensions[i].length-1){
			    stack[i] = 0; // carry to next stack address
			    stack[i+1]++;
			}
		    }
                    if(stack[stack.length-1] > dimensions[dimensions.length-1].length-1) // if the last one needs carry...
			return; // all done
		    var schedule = new Array(dimensions.length-1);
		    for(var i=0; i<dimensions.length; ++i) // map stack address values to dimension address values
			schedule[i] = dimensions[i][stack[i]];
		    perm = schedule
		    yield schedule;
		    stack[0]++; // incriment stack
		}
            },
	    // check if a schedule in the form of sched:[course...] has no conflicts
	    schedCompat: function(sched){
		if(sched.length == 1)
		    return true; // if there's one class, it's automatically valid
		var backStack = [sched[0]]; // create a stack full of courses to check each new course against
		var schedComp = 1;
		while(schedComp < sched.length){ // go until sched is empty
		    for(var i = 0; i<backStack.length; ++i)
			if(!this.courseCompat(backStack[i], sched[schedComp])) // check all of backStack against the last course in sched
			    return false; // if any are incompatable, the whole schedule is incompatable
		    backStack.push(sched[schedComp++]); // move the one we just checked against backStack into backStack to check against everything else
		} // we can't just pop because references
		return true; // if none are incompatable, then the schedule is valid
	    },
	    // expand courses into meeting times and check validity
	    // this is needed because some courses have multiple meeting times
	    courseCompat: function(a, b){
		return a.meetingsFaculty.reduce(function(a_compat, a_meeting){ // check every meeting in a...
		    return a_compat && b.meetingsFaculty.reduce(function(b_compat, b_meeting){ // against every meeting in b
			return b_compat && app.meetingCompat(a_meeting.meetingTime, b_meeting.meetingTime);
		    }, true); // so if every meeting in b is compatable with...
		}, true); // every meeting in a, return true else return false
	    },
	    // Check if two meetings are compatable
	    meetingCompat: function(a, b){
		if(!this.daylist(true).reduce(function(acc, day){ // check if any of the days overlap
		    return acc || (a[day] && b[day]); // and carry over any trues
		}, false))
		    return true; // if the two aren't even on the same days, we knot it's compatable
		return !( (a.beginTime >= b.beginTime && a.beginTime <  b.endTime)|| // beginning time of a is within b
			  (a.endTime   >  b.beginTime && a.endTime   <= b.endTime)|| // end       time of a is within b
			  (b.endTime   >  a.beginTime && b.endTime   <= a.endTime)|| // beginning time of b is within a
			  (b.endTime   >  a.beginTime && b.endTime   <= a.endTime) ) // end       time of b is within a
	    },
            getHash: function() {
		return location.hash;
            },
            save: function() {
		ga('send', 'event', 'schedule', 'save');
		
		if(!this.currentstorage) {
                    var name = window.prompt("Please enter a name for the schedule");
                    if(!name) return;
                    this.currentstorage = name;
		}
		
		if(!localStorage.schedules) localStorage.setItem('schedules', JSON.stringify({}));
		var schedules = JSON.parse(localStorage.schedules);
		schedules[this.currentstorage] = this.generateHash();
		localStorage.setItem('schedules', JSON.stringify(schedules));
		this.localStorage = schedules;
		this.changed = false;
		console.log(this.localStorage)
            },
            load: function(schedule) {
		ga('send', 'event', 'schedule', 'load');

		if(this.changed && this.selected.length) {
                    if (!window.confirm("Are you sure you want to discard your changes?")) {
			return;
                    }
		}
		if(this.currentstorage === schedule) return;
		this.currentstorage = schedule;
		this.changed = false;
		location.hash = this.localStorage[schedule];
		
		if ((index = this.terms.map(function(el){return el.code}).indexOf(location.hash.slice(1, 7))) > -1)
		{
                    if(this.term != this.terms[index]) {
			this.term = this.terms[index];
			this.changedTerm(true);
                    }
                    else {
			this.course = null;
			this.search = "";
			this.term = this.terms[index];
			var hashes = location.hash.slice(8).split(',');
			this.selected = this.courses.filter(function(course){
			    return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
			});
                    }
		}
		this.justLoaded = false;
            },
            discard: function() {
		ga('send', 'event', 'schedule', 'discard');

		if (!window.confirm("Are you sure you want to discard your changes?")) {
                    return;
		}
		this.changed = false;
		var schedule = this.currentstorage;
		this.currentstorage = null;
		this.load(schedule);
            },
            saveNew: function() {
		ga('send', 'event', 'schedule', 'save-new');

		this.currentstorage = null;
		this.save();
            },
            deleteSchedule: function() {
		ga('send', 'event', 'schedule', 'delete');

		if (window.confirm("Are you sure you want to delete the schedule " + this.currentstorage + "?")) {
                    var schedules = JSON.parse(localStorage.schedules);
                    delete schedules[this.currentstorage];
                    localStorage.setItem('schedules', JSON.stringify(schedules));
                    this.localStorage = schedules;
                    this.changed = false;
                    this.clear();
		}
            },
            clear: function() {
		ga('send', 'event', 'schedule', 'new');

		if(this.changed) {
                    if (!window.confirm("Are you sure you want to discard your changes?")) {
			return;
                    }
		}
		this.selected = [];
		this.currentstorage = null;
		this.justLoaded = false;
            },
            webclasses: function(courses)
            {
		return courses.filter(function(course){
		    return course && (course.meetingsFaculty.map(function(el){return el.meetingTime.building == "ONLINE"}).reduce(function(a, b){return a || b}));
		});
            },
            changedTerm: function(loadHash)
            {
		ga('send', 'event', 'term', 'change');
		if(this.currentstorage && loadHash !== true) this.clear();
		this.course = null;
		this.search = "";
		this.courses = [];
		this.selected = [];		

		xhrzip(server_cx("registration"), function() { // This is needed to for cookie spoofing
		    if (this.readyState === 4 && this.status === 200) {
			let recursive_loader = function(rec = null){
			    let offset = rec ? rec.data.length : 0;
			    xhrzip(server_cx("searchResults/searchResults?txt_term=201990&startDatepicker=&endDatepicker=&pageOffset=" + offset.toString() + "&pageMaxSize=" + chunk.toString() + "&sortColumn=subjectDescription&sortDirection=asc"), function () {
				if (this.readyState === 4 && this.status === 200) {
				    let response = JSON.parse(this.responseText);
				    if(!rec){
					rec = response;
				    } else {
					response.data.forEach(function(el){
					    rec.data.push(el);
					}, this);
				    }
				    
				    console.log(rec);
				    app.percent = rec.data.length.toString() + '/' + rec.sectionsFetchedCount.toString();
				    if(rec.data.length < (test_percent_cap ? test_percent_cap/100*rec.sectionsFetchedCount : rec.sectionsFetchedCount)){
					recursive_loader(rec);
				    } else {
					app.courses = rec.data.reduce(function(acc, cur){
					    if(acc.length > 0){
						if(acc[acc.length-1].subjectCourse == cur.subjectCourse){
						    var i = acc.length-1;
						    for(; !acc[i].alts; --i);
						    cur.home = acc[i];
						    acc[i].alts = acc[i].alts.concat(cur);
						} else {
						    cur.alts = [];
						    cur.home = cur;
						}
						return acc.concat(cur);
					    } else {
						cur.alts = [];
						cur.home = cur;
						return [cur];
					    }
					}, []);
					if (loadHash === true && app.hashExists())
					{
					    var hashes = location.hash.slice(8).split(',');
					    app.selected = app.courses.filter(function(course){
						return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
					    });
					}
				    }
				}
			    });
			}
			recursive_loader();
		    }
		});
            },
	    genFaculty: function(c)
	    {
		let out = ""
		c.faculty.forEach(function(el){
		    out+=el.displayName+", and ";
		});
		return out ? out.substr(0, out.length-6) : "STAFF";
	    },
            courseHere: function(day, hour, course){
		if (!course) return;
		var res = null;
		
		course.meetingsFaculty.forEach(function(meeting){
		    let time = meeting.meetingTime;
		    if (time.building == 'WS' || !time.beginTime || !time[day]) return;
		    var start = this.convertTime(time.beginTime);
		    var end = this.convertTime(time.endTime);
		    if (Math.trunc(start, 0) != hour-8) return;
		    res = {
			top: start-Math.trunc(start,0),
			length: end-start,
			loc: time.building + time.room,
		    }
		}.bind(this));
		return res;
            },
            convertTime: function(time)
            {
		var minute = time.substr(-2);
		return parseFloat(time.substr(0, time.length-minute.length), 10)+parseFloat(minute)/60-8;
	    },
            click: function(course)
            {
		if (this.autoInAlts(this.course, course)) // needs to be added to selected
		{
                    ga('send', 'event', 'course', 'add');
                    this.course = null;
                    this.selected.push(course);
		}
		else
		{
                    ga('send', 'event', 'course', 'remove');
                    this.selected.splice(this.selected.indexOf(course), 1);
                    this.hovering = false;
		}

		location.hash = this.generateHash();
		this.changed = true;
		this.justLoaded = false;
		
            },
            hashExists: function()
            {
		return location.hash.match(/#\d+=[\d+,?]+/);
            },
            generateHash: function() {
		var hash = this.term.code + "=";
		hash += this.selected.map(function(s){
		    return s.courseReferenceNumber;
		}).join();
		return hash;
            },
	    daylist: function(tolower){
		return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
			this.selected.concat(this.course).map(function(c){
			    if(!c) return false;
			    return c.meetingsFaculty.map(function(m){
				return m.meetingTime.saturday || m.meetingTime.sunday
			    }).reduce(function(a, b){
				return a || b;
			    })
			}).reduce(function(a, b){
			    return a || b
			}) ? "Saturday" : "",
			this.selected.concat(this.course).map(function(c){
			    if(!c) return false;
			    return c.meetingsFaculty.map(function(m){
				return m.meetingTime.sunday
			    }).reduce(function(a, b){
				return a || b;
			    })
			}).reduce(function(a, b){
			    return a || b
			}) ? "Sunday" : ""].filter(function(el){
			    return el!=""
			}).map(function(el){
			    return tolower ? el.toLowerCase() : el;
			});
	    }
	}
    });

// Analytics
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
			 m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
			})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-96461430-1', 'auto');
ga('send', 'pageview');


// HeadUser
(function () { var hu = document.createElement("script"); hu.type = "text/javascript"; hu.async = true; hu.src = "//www.heeduser.com/supfiles/Script/widget.js"; var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(hu, s); })()
var _heeduser = {
    type: "button",
    community: "sitscheduler",
    url: "http://sitscheduler.heeduser.com",
    placement: "middle-right",
    color: "#202021",
    widget_layout: "full",
    sso_token: ""
}
var heeduser_url = _heeduser.url + "/FeedbackWidget/Widget.aspx?sso_token=" + encodeURIComponent(_heeduser.sso_token);
document.getElementById("feedback").innerHTML = '<a id="heeduser_wb" href="JavaScript:heeduser_openwidget(heeduser_url,\'' + _heeduser.widget_layout + '\')">Leave your feedback!</a>';

