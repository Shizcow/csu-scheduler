/* config.js
This file contains various configs for developing or adapting to other colleges
If you're lucky, this file contains everything you need to do so

The intent is to minimize the need to look around in other files when
adapting this for other colleges. Read through this entire file and
your job will be a lot easier. Each section has a small guide.

This file is split into sections, indicated by ascii art.
Those sections are as follows:
-Developer options
 L->Useful for testing non-production versions
-librequests URLS
 L->Used for configuring URLS for outgoing requests
-librequests processing
 L->Used to process incoming requests and construct course objects
-misc
 L->Used for determining names of files, error messages, and your college's name

NOTE: This project requires minification. Run the make command to see changes in browser.
*/

/**
 * app_config
 *
 * Namespace object for holding config values defined below - don't touch this
 *
 * @namespace
 * @constant
 */
const app_config = {};

/*_____  ________      ________ _      ____  _____  ______ _____  
 |  __ \|  ____\ \    / /  ____| |    / __ \|  __ \|  ____|  __ \ 
 | |  | | |__   \ \  / /| |__  | |   | |  | | |__) | |__  | |__) |
 | |  | |  __|   \ \/ / |  __| | |   | |  | |  ___/|  __| |  _  / 
 | |__| | |____   \  /  | |____| |___| |__| | |    | |____| | \ \ 
 |_____/|______|   \/   |______|______\____/|_|    |______|_|  \_\
                                                                  
   ____  _____ _______ _____ ____  _   _  _____ 
  / __ \|  __ \__   __|_   _/ __ \| \ | |/ ____|
 | |  | | |__) | | |    | || |  | |  \| | (___  
 | |  | |  ___/  | |    | || |  | | . ` |\___ \ 
 | |__| | |      | |   _| || |__| | |\  |____) |
  \____/|_|      |_|  |_____\____/|_| \_|_____/ 

This section contains options useful for non-production versions
*/

/**
 * app_config.test_percent_cap
 *
 * Used for testing - out of a given term, this is how many courses are to be loaded                  
 * A lower percentage means fewer courses, which means less functionality but faster loading & testing
 * 
 * @type {number}
 * @memberOf app_config
 * @constant
 */
app_config.test_percent_cap = 100;

/**
 * app_config.chunk
 *
 * Used for performance tuning - for each large courses request, this is how many courses are requested
 * A lower number means fewer courses requested per request and thus faster requests, but more requests overall
 *
 * @type {number}
 * @memberOf app_config
 * @constant
 */
app_config.chunk = 300;


/*_      _____ ____  _____  ______ ____  _    _ ______  _____ _______ _____ 
 | |    |_   _|  _ \|  __ \|  ____/ __ \| |  | |  ____|/ ____|__   __/ ____|
 | |      | | | |_) | |__) | |__ | |  | | |  | | |__  | (___    | | | (___  
 | |      | | |  _ <|  _  /|  __|| |  | | |  | |  __|  \___ \   | |  \___ \ 
 | |____ _| |_| |_) | | \ \| |___| |__| | |__| | |____ ____) |  | |  ____) |
 |______|_____|____/|_|  \_\______\___\_\\____/|______|_____/   |_| |_____/
  _    _ _____  _       _____ 
 | |  | |  __ \| |     / ____|
 | |  | | |__) | |    | (___  
 | |  | |  _  /| |     \___ \ 
 | |__| | | \ \| |____ ____) |
  \____/|_|  \_\______|_____/

Nessicary for handling URLS for outgoing requests
VERY important for making this work with other colleges
This area will need the most tweaking, and librequests.js might 
need some as well

IMPORTANT NOTE:
The first step in adapting this for another college is getting data
to come through in the first place. Here's a rough gide on how to do that.

1) Find out where the courses data server is located
This can be done a few ways, but the easiest way is through dev tools in
your browser. Open it and start looking at network traffic. Then, head
to your college's course catalogue or registration site. Somewhere
that courses are loaded in a big list and you can search through them.
Then, get to the point where you're about to load some courses. Clear
the network traffic log, then load in some courses. You'll see some
requests coming in. Sort through them until you find the one (or more)
that contain course JSON data. If your college doesn't use JSON, good luck.
Note the URL where the JSON comes from. This is the data server.

2) Find the URLprefix
Repeat step 1 with a few different things. Try loading what terms are
available for registration, courses, descriptions, etc. All the URLs
should have a common prefix. If they don't, they do, even if it's just
'https://' -- fill this out below as app_config.URLprefix.

3) Find URL patterns
Now that you have a list of URLs for getting data, start looking at them closer.
You'll notice some patterns when requesting courses. For CSU, it's
like this after the prefix:
searchResults/searchResults?txt_term=TERMCODE&startDatepicker=&endDatepicker=&pageOffset=START&pageMaxSize=CHUNK&sortColumn=subjectDescription&sortDirection=asc
-where TERMCODE is the code used to specify what term courses are coming from
-where START is where we want to start from in the big master list of courses
-where CHUNK is how many courses we want to load
Now, figure out what these patterns are for available terms, courses in each term,
and (if applicable) where you can find course descriptions. Fill these in as:
app_config.URLgetTerms()
app_config.URLgetCourses()
app_config.URLgetDescription()
Now, if these are all GET requests, easy. If they're post requests, pay attention
to the parameters too, you can fill those in too. Use the GETPOST parameter.

4) Learn a bit about what courses are available
With some colleges, you need to make multiple requests in order to load all courses
in a given term. In this case, you need to know how many courses there are to load.
Fill out:
app_config.URLgetCourseTotalCount()
NOTE: if your college is nice and you only need to make a single request for all the
courses in a term, you still need to go check the notes above app_config.URLgetCourseTotalCount()

5) Get it working by itself
Now that you have all the URLS you need, you need to be able to actually make requests.
Why is this important to note? Some colleges require session authentication cookies,
which make it impossible to come out of the blue and request courses, but possible
to request courses on the college's website. This is usually done through a request
on each session, or a request on each term change. In order to handle both of these
scenarios, there are two built in request functions. They are as follows:
app_config.URLtest() and app_config.URLprime()
URLtest  deals with the session approach
URLprime deals with the term    approach
They can be used together, appart, or not at all. If not needed, set GETPOST.url to ""
At this point, figure out what requests you need to make in order to make term and 
course requests off of the official site. Then fill out:
app_config.URLtest()
app_config.URLprime()

After these steps, you should be able to get JSON incoming. Check the network traffic
for this page while it's trying to load terms. For now, ignore errors in the JS console
and things breaking on the page. The important part is being able to check each request
and see JSON coming in properly. If you can get this to work, continue on to the next section
*/

/**
 * app_config.useCredentials
 * 
 * Whether or not your college uses AUTH cookies
 * If you can't get thing's to load, change this value
 *
 * @type {boolean}
 * @memberOf app_config
 * @constant
 */
app_config.useCredentials = true;//false;

/**
 * app_config.URLprefix
 *
 * The common URL prefix for all incoming data from your university's server
 * should look like 'https://server.college.edu/courseCommon/'
 * every request will start with this string, and have data appended to it
 * if you have a special case, it can be addressed in specific functions
 * this is for convienence only
 *
 * NOTE: If you are able to use a CORS proxy, this is a good place to prefix it.
 * However, if your college uses header cookies (like CSU) it might difficult or
 * impossible to use a direct proxy to load courses from your college.
 * Two options: 1) Forget about CORS and set app_config.CORStest to true
 *                 while you wait for your college to add Allow-Access-Control-Origin
 *              2) Set up your own server that loads courses and re-distributes
 *                 them to end-users, appending Allow-Access-Control-Origin yourself
 *                 This means less overhead on your college but way more work on your end
 *
 * @type {string}
 * @memberOf app_config
 * @constant
 */
//app_config.URLprefix = 'https://api.pohldev.in/csucrawler/';
app_config.URLprefix = 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/';

/**
 * Before we continue, it's time to introcude the GETPOST object
 * When an XMLHttp request is made, it can be inspected through a browser's network traffic monitor
 * This object has properties which are to be set to hold that information
 *
 * Params:
 *   url         The URL which the request takes place			 	 
 *   openMethod  Request type: must be set to either "GET" or "POST"		 
 *   postData    used when openMethod is "POST", and contains the data to post	 
 *               may be left unchanged if not a POST request			 
 *
 * @typedef {{
 *            url:string,
 *	      openMethod:string,
 *	      postData:string
 *          }}
 */
var GETPOST;

/**
 * app_config.URLgetTerms(GETPOST)
 *
 * This function is used to get the URL needed for querying available terms
 * the response of which will be processed in app_config.PROCESSgetTerms()
 *
 * @param {!GETPOST} GETPOST
 *
 * @memberOf app_config
 * @constant
*/
app_config.URLgetTerms = function(GETPOST){
    GETPOST.openMethod = "GET";
    // GET request - no need to set postData
    //GETPOST.url = app_config.URLprefix + "terms";
    //GETPOST.url = app_config.URLprefix + "classSearch/getTerms?searchTerm=&offset=1&max=100&_=1554348528566";
    GETPOST.url = app_config.URLprefix + "classSearch/getTerms?mepCode=CSU&searchTerm=&offset=1&max=100&_=1600878705085";
};

/**
 * app_config.URLgetCourses(GETPOST, termURLcode, offset, size)
 *
 * This function is used to get the URL needed for quering courses residing in a specific term
 *
 * @param   {!GETPOST} GETPOST      GETPOST object
 * @param   {string}   termURLcode  URL code used to represent a term in a term request
 * @param   {string}   offset       A decimal number string representing the starting index of the
 *                                  desired chunk in a master list of all courses
 * @param   {number}   size         A decimal number representing the total number of courses being requested
 *
 * @memberOf app_config
 * @constant
 */
app_config.URLgetCourses = function(GETPOST, termURLcode, offset, size){
    GETPOST.openMethod = "GET";
    //GETPOST.url = app_config.URLprefix + "term?" + termURLcode;
    //GETPOST.url = app_config.URLprefix + "searchResults/searchResults?txt_term=" + termURLcode + "&startDatepicker=&endDatepicker=&pageOffset=" + offset + "&pageMaxSize=" + size.toString() + "&sortColumn=subjectDescription&sortDirection=asc";
    GETPOST.url = app_config.URLprefix + "searchResults/searchResults?mepCode=CSU&txt_term=" + termURLcode + "&startDatepicker=&endDatepicker=&pageOffset=" + offset + "&pageMaxSize=" + size.toString() + "&sortColumn=subjectDescription&sortDirection=asc";
};

/**
 * app_config.URLgetDescription(GETPOST, termURLcode, courseURLcode)
 *
 * This function is used to get the URL needed for quering a course description
 *
 * @param {!GETPOST} GETPOST        GETPOST object
 * @param {string}   termURLcode    URL code used to represent a term in a term request
 * @param {string}   courseURLcode  URL code representing a course ID
 *
 * @memberOf app_config
 * @constant
 */
app_config.URLgetDescription = function(GETPOST, termURLcode, courseURLcode){
    //GETPOST.openMethod = "GET";
    //GETPOST.url = app_config.URLprefix + "description?t=" + termURLcode + "&c=" + courseURLcode;
    GETPOST.openMethod = "POST";
    GETPOST.url = app_config.URLprefix + "searchResults/getCourseDescription";
    GETPOST.postData = "term=" + termURLcode + "&courseReferenceNumber=" + courseURLcode;
};

/**
 * app_config.URLgetCourseTotalCount(GETPOST, termURLcode)
 *
 * This function returns the URL needed for checking how many courses can be loaded in a single term
 * For example, if we're looking at Fall 2019 and there are 6610 courses in this term, this function
 * should set the URL to that which when loaded has data containing 6610.
 *
 * NOTE: if your college is nice and gives you all the courses in a single request, and thus you don't
 *       need to count them, set GETPOST.url to "" and return
 *
 * @param {!GETPOST} GETPOST        GETPOST object
 * @param {string}   termURLcode    URL code used to represent a term in a term request
 *
 * @memberOf app_config
 * @constant
 */
app_config.URLgetCourseTotalCount = function(GETPOST, termURLcode){
    // this example just loads as few courses as possible to get some data - may not be the same
    // at every school
    GETPOST.openMethod = "GET";
    GETPOST.url = app_config.URLprefix + "searchResults/searchResults?mepCode=CSU&txt_term=" + termURLcode + "&startDatepicker=&endDatepicker=&pageOffset=0&pageMaxSize=10&sortColumn=subjectDescription&sortDirection=asc";
};

/**
 * app_config.URLtest(GETPOST)
 *
 * This function returns the URL needed for two things
 * 1) setting session auth cookies
 * 2) testing whether or not we're being blocked by CORS
 *     During development, you'll probbaly be blocked by CORS and will need an extension to disable it
 *     This function decides whether or not you need that extension
 * So you must make a requst here, even if it's to the course main page
 * This function is activated only once, on load of the webpage
 *
 * @param {!GETPOST} GETPOST        GETPOST object
 *
 * @memberOf app_config
 * @constant
*/
app_config.URLtest = function(GETPOST){
    GETPOST.openMethod = "GET";
    GETPOST.url = app_config.URLprefix;
};

/**
 * app_config.URLprime(GETPOST, termURLcode)
 *
 * This function is used to get the URL needed for "priming" a request,
 * or asking the server for cookies needed to make requests.
 * This function is activated on every term change before requesting courses
 *
 * @param {!GETPOST} GETPOST        GETPOST object
 * @param {string}   termURLcode    URL code used to represent a term in a term request
 *
 * @memberOf app_config
 * @constant
*/
app_config.URLprime = function(GETPOST, termURLcode){
    //GETPOST.url = ""; // this is an example where your life is easy and you don't
    //return;           // need to bother with cookies
    GETPOST.openMethod = "POST";
    GETPOST.url = app_config.URLprefix + "term/search?mepCode=CSU&mode=search";
    GETPOST.postData = "term=" + termURLcode + "&studyPath=&studyPathText=&startDatepicker=&endDatepicker=";
};


/*_      _____ ____  _____  ______ ____  _    _ ______  _____ _______ _____ 
 | |    |_   _|  _ \|  __ \|  ____/ __ \| |  | |  ____|/ ____|__   __/ ____|
 | |      | | | |_) | |__) | |__ | |  | | |  | | |__  | (___    | | | (___  
 | |      | | |  _ <|  _  /|  __|| |  | | |  | |  __|  \___ \   | |  \___ \ 
 | |____ _| |_| |_) | | \ \| |___| |__| | |__| | |____ ____) |  | |  ____) |
 |______|_____|____/|_|  \_\______\___\_\\____/|______|_____/   |_| |_____/
  _____  _____   ____   _____ ______  _____ _____ _____ _   _  _____ 
 |  __ \|  __ \ / __ \ / ____|  ____|/ ____/ ____|_   _| \ | |/ ____|
 | |__) | |__) | |  | | |    | |__  | (___| (___   | | |  \| | |  __ 
 |  ___/|  _  /| |  | | |    |  __|  \___ \\___ \  | | | . ` | | |_ |
 | |    | | \ \| |__| | |____| |____ ____) |___) |_| |_| |\  | |__| |
 |_|    |_|  \_\\____/ \_____|______|_____/_____/|_____|_| \_|\_____|

This sections is used for processing incoming data and preparing it to work
with the rest of the source code.
This is important because it takes less work to modify data than it does to
modify source code.

So let's assume you followed the librequests URLs guide and you're ready
to get some stuff up on screen. In order to make that happen, you need to
process incoming data, and it stands to reason that incoming data will
be different for each college. So, here's a guide on how to process your
data in such a way that it will magically work with the rest of the site:

---Process URL recieved data
So let's assume you've overcame the hardest part: getting things to load.
Now you need to get that stuff to display on screen. First up is terms.
In each of the PROCESSget functions, results are daken directly from the
URLget functions we defined eariler. Specific instructions and templates
are found in functions. Fill them out in this order:
app_config.PROCESSgetTerms()
app_config.PROCESSgetCourseTotalCount()
app_config.PROCESSgetCourses()
app_config.PROCESSgetDescription()
*/

/**
 * We're going to process terms first, so here's how Term objects look
 * 
 * Params:                     
 *   URLcode    Code used to represent the term in URLS	       
 *   title      Human readable description, like "Fall 2019"      

 *
 * @typedef  {{
 *             URLcode:string,
 *             title:string
 *           }}
 */
var Term;


/**
 * app_config.PROCESSgetTerms(responseText)
 *
 * This function is used to process incoming term data into a way
 * the source can understand
 * This function takes one parameter: responseText. This is more
 * or less taken directly from the XMLHttpRequest.onreadystatechange
 * method as XMLHttpRequest.responseText, and should be treated as such
 *
 * Now, for processing rules. With the input of responseText, construct
 * a list of Term Objects - 
 *
 * here's an example:
 *     responseText (literal text):
 *     [
 *       {
 *         "code": "201990",
 *         "description": "Fall Semester 2019"
 *       },
 *       {
 *         "code": "201960",
 *         "description": "Summer Session 2019"
 *       },
 *       {
 *         "code": "201910",
 *         "description": "Spring Semester 2019"
 *       }
 *     ]
 *     
 *     desired return value as an array of objects:
 *     [
 *       {
 *         URLcode: "201990",
 *         title: "Fall Semester 2019"
 *       },
 *       {
 *         URLcode: "201960",
 *         title: "Summer Session 2019"
 *       },
 *       {
 *         URLcode: "201910",
 *         title: "Spring Semester 2019"
 *       }
 *     ]
 *
 * @param   {string} responseText    XMPHttpRequest.responseText
 *
 * @returns {!Array<!Term>}          List of term objects
 *
 * @memberOf app_config
 * @constant
*/
app_config.PROCESSgetTerms = function(responseText){
    //return JSON.parse(responseText).map(t => ({"URLcode": t.URLcode, "title": t.title}));
    var termJSON = JSON.parse(responseText);
    var ret = [];
    termJSON.forEach(function(termObj){
	ret.push({URLcode: termObj.code, title: termObj.description});
    });
    return ret;
};

/**
 * app_config.PROCESSgetCourseTotalCount(responseText)
 *
 * This function is similar to app_config.PROCESSgetTerms, but a lot more simple
 * 
 * The goal here is to take incoming responseText and return an integer
 * representing the total number of courses that can be loaded for a term
 *
 * @param   {string} responseText    XMPHttp.responseText
 *
 * @returns {number}                 Total number of courses for a term
 *
 * @memberOf app_config
 * @constant
 */
app_config.PROCESSgetCourseTotalCount = function(responseText){
    //return JSON.parse(responseText).length; // reference w/ bracket notation please - closure compiler shuts up
    if(JSON.parse(responseText).success == "false")
	console.trace("there's something wrong!");
    return JSON.parse(responseText)['totalCount']; // reference w/ bracket notation please - closure compiler shuts up
};

/**
 * We're about to introduce the course Object type, but first it's time to introduce the Meeting Object
 * Each Course Object (coming soon) contains a list of Meeting Objects
 * These are used to tell when a class is held - what times, days of the week, etc
 *   
 * Params:
 *  All of these properties are to be set in app_config.PROCESSgetTerms
 *   building     Building shortcode where the class is held                           
 *   room         Room number where the class is held                                  
 *   beginTime    When the class begins                                                
 *                String representation, military time, no colon. Ex: "1430" for 2:30pm
 *   endTime      Same as above, but for when the class ends                           
 *   monday       Is the course held on monday?                                        
 *   tuesday      ^                                                                    
 *   wednesday    ^                                                                    
 *   thursday     ^                                                                    
 *   friday       ^                                                                    
 *   saturday     ^                                                                    
 *   sunday       ^                                                                    
 *
 * @typedef  {{
 *             building:string,
 *             room:string,
 *             beginTime:string,
 *             endTime:string,
 *             monday:boolean,
 *             tuesday:boolean,
 *             wednesday:boolean,
 *             thursday:boolean,
 *             friday:boolean,
 *             saturday:boolean,
 *             sunday:boolean
 *           }}
 */
var Meeting;

/**
 * Before we continue, it's time to introcude the Course Object
 * This object holds all information about a specific course
 *
 * Params:
 *  The following properties must be set later in app_config.PROCESSgetCourses:
 *   courseNumber               MATH 101 => "101"                                      
 *   subject                    MATH 101 => "MATH"                                     
 *   title                      MATH 101 => "Introduction to College Algebra"          
 *   credits                    The integer number of credits for the course           
 *                              If this is a lab/etc part to a class, this should be 0 
 *   faculty                    Names of instructors, preferrably in a list            
 *   scheduleTypeDescription    "Lab", "Lecture", "Recetation", etc.                   
 *   URLcode                    URL code representing a course ID                      
 *   courseRegistrationCode     Code used to register for a course                     
 *   meetings                   Explained in next JSDoc comment above                  
 *                                                                                     
 *   The following properties may optionally be set in app_config.PROCESSgetCourses if available:
 *   sessionMod                 some colleges like to specify sessions in course number
 *                              this value captures that session data, like:           
 *                                                                 "MATH 245A" -> "A"  
 *                                                                 "PSY 525RA" -> "RA" 
 *   maximumEnrollment          Max number of enrollment seats
 *   seatsAvailable             Number of seats open for enrollment
 *   waitAvailable              Max number of waitlist seats
 *   waitCapacity               Number of waitlist seats available
 *
 *
 *   The following properties are automatically assigned later and are only used internally:
 *   home                       The first of a chunk of sections (all MATH 101 sections
 *   alts                       List of all other sections, grouped by scheduleTypeDescription
 *   index                      Position in app.courses master list - used for reference
 *
 * Here's an example of a properly formatted course object, including meetings (defined below):
 *     {
 *      courseNumber: "101"
 *      URLcode: "29948"
 *      title: "Introduction to College Algebra"
 *      credits: 4
 *      faculty: "Jon Doe, Mike Smith, and Sarah Williams"
 *      meetings: [
 *                 {
 *     	            building: "BC"
 *     	            room: "104"
 *     	            beginTime: "900"
 *     	            endTime: "1030"
 *     	            monday: true
 *     	            tuesday: false
 *     	            wednesday: true
 *     	            thursday: false
 *     	            friday: true
 *     	            saturday: false
 *     	            sunday: false
 *     	           },
 *                 {
 *     	            building: "RA"
 *     	            room: "209"
 *     	            beginTime: "1230"
 *     	            endTime: "1400"
 *     	            monday: false
 *     	            tuesday: true
 *     	            wednesday: false
 *     	            thursday: true
 *     	            friday: false
 *     	            saturday: false
 *     	            sunday: false
 *     	           }
 *                ]
 *      scheduleTypeDescription: "Lecture"
 *      subject: "MATH"
 *      maximumEnrollment: "100"
 *      seatsAvailable: "25"
 *     }
 *
 * @typedef {{
 *            courseNumber:string,
 * 	      subject:string,
 * 	      title:string,                  
 * 	      credits:number,                
 * 	      faculty:string,                
 * 	      scheduleTypeDescription:string,
 * 	      URLcode:string,                
 * 	      courseRegistrationCode:string, 
 * 	      meetings:!Array<!Meeting>,           
 * 	      sessionMod:string,                
 * 	      maximumEnrollment:number,      
 * 	      seatsAvailable:number,         
 * 	      waitAvailable:number,          
 * 	      waitCapacity:number,           
 * 	      home:!Course,                  
 * 	      alts:!Array<!Array<!Course>>,                
 * 	      index:number
 *          }}
 */
var Course;

/**
 * app_config.PROCESSgetCourses(responseText)
 *
 * This function is similar to app_config.PROCESSgetTerms
 *
 * The goal here is to take incoming responseText and coax it into a form
 * the rest of the source code will understand, IE Course objects (defined above)
 *
 * NOTE: Do NOT filter any courses here. The length of the returned array is
 * very important and should include all courses loaded from a webrequest
 *
 * To see which properties need to be set, see the Course Object definition above
 *
 * @param   {string}   responseText    XMPHttp.responseText
 *
 * @returns {!Array<!Course>}          List of courses with members properly set
 *
 * @memberOf app_config
 * @constant
*/
/*app_config.PROCESSgetCourses = function(responseText){
    var coursesJSON = JSON.parse(responseText);
    var ret_courses = [];
    coursesJSON.forEach(function(courseJSON){
	var ret_course = {}; // of type Course
	ret_course.courseNumber = courseJSON['courseNumber'];
	ret_course.URLcode = courseJSON['URLcode'];
	ret_course.courseRegistrationCode = courseJSON['courseRegistrationCode'];
	ret_course.title = courseJSON['title'];
	
	ret_course.credits = courseJSON['credits'];

	ret_course.faculty = courseJSON['faculty'];
	
	ret_course.scheduleTypeDescription = courseJSON['scheduleTypeDescription'];
	ret_course.subject = courseJSON['subject'];
	ret_course.maximumEnrollment = courseJSON['maximumEnrollment'];
	ret_course.seatsAvailable = courseJSON['seatsAvailable'];
	ret_course.waitAvailable = courseJSON['waitAvailable'];
	ret_course.waitCapacity = courseJSON['waitCapacity'];

	ret_course.meetings = courseJSON['meetings'];
	
	ret_courses.push(ret_course);
    });
    return ret_courses;
    };*/
app_config.PROCESSgetCourses = function(responseText){
    var coursesJSON = JSON.parse(responseText).data;
    var ret_courses = [];
    coursesJSON.forEach(function(courseJSON){
	var ret_course = {}; // of type Course
	ret_course.courseNumber = courseJSON['courseNumber'];
	ret_course.URLcode = courseJSON['courseReferenceNumber'];
	ret_course.courseRegistrationCode = courseJSON['courseReferenceNumber'];
	ret_course.title = courseJSON['courseTitle'];
	
	ret_course.credits = 0;
	if(courseJSON.creditHours != undefined)
	    ret_course.credits = courseJSON['creditHours'];
	else if(courseJSON.creditHourLow != undefined)
	    ret_course.credits = courseJSON['creditHourLow'];
	else if(courseJSON.creditHourHigh != undefined)
	    ret_course.credits = courseJSON['creditHourHigh'];

	if(courseJSON.faculty === undefined || courseJSON.faculty.length == 0)
	    ret_course.faculty = "STAFF";
	else
	    ret_course.faculty = courseJSON['faculty'].map((obj, index, array) => (array.length > 1 && index == array.length-1 ? "and " : "") + obj.displayName.split(", ").reverse().join(" ")).join(", ");
	// make a list in form of "first last, first last, and first last"
	// from ["last, first", "last, first", "last, first"] w/ keys

	ret_course.scheduleTypeDescription = courseJSON.scheduleTypeDescription;
	ret_course.subject = courseJSON.subject;
	ret_course.maximumEnrollment = courseJSON.maximumEnrollment;
	ret_course.seatsAvailable = courseJSON.seatsAvailable;
	ret_course.waitAvailable = courseJSON.waitAvailable;
	ret_course.waitCapacity = courseJSON.waitCapacity;

	if(courseJSON['meetingsFaculty'] !== undefined)
	    ret_course.meetings = courseJSON['meetingsFaculty'].map(function(meetingFaculty){
		return {
		    building: meetingFaculty['meetingTime'].building,
		    room: meetingFaculty['meetingTime'].room,
		    beginTime: meetingFaculty['meetingTime'].beginTime,
		    endTime: meetingFaculty['meetingTime'].endTime,
		    monday: meetingFaculty['meetingTime'].monday,
		    tuesday: meetingFaculty['meetingTime'].tuesday,
		    wednesday: meetingFaculty['meetingTime'].wednesday,
		    thursday: meetingFaculty['meetingTime'].thursday,
		    friday: meetingFaculty['meetingTime'].friday,
		    saturday: meetingFaculty['meetingTime'].saturday,
		    sunday: meetingFaculty['meetingTime'].sunday
		};
	    });
	else
	    ret_course.meetings = [];
	
	ret_courses.push(ret_course);
    });
    return ret_courses;
};

/**
 * app_config.PROCESSgetDescription(responseText)
 *
 * Again, very similar to app_config.PROCESSgetTerms, but even more simple
 *
 * The goal here is to take responseText, process it to look friendly on screen,
 * and return the value, that's it
 *
 * @param {string}   responseText    XMLHttpRequest.responseText
 *
 * @returns {string}                 Course description
 *
 * @memberOf app_config
 * @constant
 */
app_config.PROCESSgetDescription = function(responseText){
    var ret = responseText.replace(/<br>/g, "\r\n").replace(/<BR>/g, "\r\n").trim(); // format
    
    while(ret.substr(0, 2) == "\r\n")
	ret = ret.substr(2, ret.length);
    //remove leading newlines
    
    while(ret.substr(ret.length-2, ret.length-1) == "\r\n")
	ret = ret.substr(0, ret.length-2);
    //remove trailing newlines
    return ret;
};



/*__  __ _____  _____  _____ 
 |  \/  |_   _|/ ____|/ ____|
 | \  / | | | | (___ | |     
 | |\/| | | |  \___ \| |     
 | |  | |_| |_ ____) | |____ 
 |_|  |_|_____|_____/ \_____|
                             
                             
This section is pretty much a big string table, all about UI.
Specifically, this is mostly about what your college names things.

Just go throuugh and fill everything out, most of it is
self explanatory
*/

/**
 * app_config.collegeName
 * Full name of your college
 * 
 * @type {string}
 *
 * @memberOf app_config
 * @constant
 */
app_config.collegeName = "Colorado State University";

/**
 * app_config.collegeNameShort
 * Few-letter abreviation for your college
 * 
 * @type {string}
 *
 * @memberOf app_config
 * @constant
 */
app_config.collegeNameShort = "CSU";

/**
 * app_config.siteTitle
 * Title for the site exposed in the browser's tab area
 * 
 * @type {string}
 *
 * @memberOf app_config
 * @constant
 */
app_config.siteTitle = "CSU Scheduler - Course Scheduler for Colorado State University";

/**
 * app_config.siteTitleShort
 * A short version of the site title used in messages
 * 
 * @type {string}
 *
 * @memberOf app_config
 * @constant
 */
app_config.siteTitleShort = "CSU Scheduler";

/**
 * app_config.courseURLcodeName
 *
 * For many colleges, when a student wants to register for a class they put in a number instead
 * of the course name. At CSU, this is a 5 digit number representing the course id.
 * This value will be shown to the user if they actually want to register for a class
 * Earlier, we defined this value as courseURLcode
 * This varible holds an abreviated (~3-4 char) name for that value that the user will understand
 *
 * For example, at CSU, this value is called the Course Reference Number, and is abreviated as CRN
 * 
 * @type {string}
 *
 * @memberOf app_config
 * @constant
 */
app_config.courseRegistrationCodeName = "CRN";

/**
 * app_config.getLogoName(isDarkMode)
 *
 * Should return the file path/name of your college's logo, the one saved in this directory         
 * At this point, you should go download the logos and place them in the same directory as this file
 * If you only have one logo, just return that file's name. If you want to have two, one for light  
 * and one for dark mode, the isDarkMode parameter should be self explanatory                       
 *
 * @param  {boolean} isDarkMode    fed from the style slider - choose a good file for both light and dark themes
 * 
 * @returns {string}               file name/path for logo
 *
 * @memberOf app_config
 * @constant
 */
app_config.getLogoName = function(isDarkMode){
    return "CSU-Signature-Stacked-357-617" + (isDarkMode ? "-rev" : "") + ".svg";
};

// These next two values are important when developing. Go read up on CORS and why it can be a problem

/**
 * app_config.CORStest
 *
 * This first value specifies whether or not to worry about CORS. The reason this needs to be here         
 * is because it's impossible to tell the difference between a normal failed network request               
 * and one that's blocked because of CORS unless you're a developer - (and not the script running          
 * on the end user's machine)                                                                              
 * If you expect to have CORS issues, maybe because your college isn't on board with this project yet,     
 * set this value to true, and the CORS noti will display for blocked users. Else, set it to false         
 * and a "your college's servers seem to be down - check again later" noti will be shown when requests fail
 *
 * @type {boolean}
 *
 * @memberOf app_config
 * @constant
 */
app_config.CORStest = true;//false;

/**
 * app_config.CORScustom
 *
 * This second value only will only matter when CORStest is set to true. At the end of the standard
 * message (found in index.js), this will be appended in bold. Use this area to outline something about        
 * how the user can convince your college to give access to the website. A name/email of the person that       
 * runs the web servers is a good idea. Here's an example:                                                     
 * app_config.CORScustom = "If you\'d like to use this tool without needing an extension, go bother Jon Doe, Director of Web Communications, (Jon.Doe@yourcollege.edu) and say you like this tool and want to see it used freeley.";
 * 
 * @type {string}
 *
 * @memberOf app_config
 * @constant
 */
//app_config.CORScustom = "";
app_config.CORScustom = "The developer ran out of hosting credits on a free trial. Sorry but I'm not paying to make this easy for you.";


// You're almost done!
//
// You should also go to index_source.html and do a few things
// 1) Go set up google analytics, then go to the top of GA.js and change the tracking tag
// 2) Change the second <meta> tag in index_source.html to properly represent your college
// 3) If there are any other scripts that need to be loaded, a good place to put them is at the end of mounted.js,
//    as that's the last script file to load

// At this point, just download logo files, edit the README and you should be all done
